import { resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { benchmark } from "../../../client/benchmark.ts";

const packageRoot = fileURLToPath(new URL("..", import.meta.url));
const entry = process.env.ROLLDOWN_DECORATORS_BENCH_ENTRY
	? resolve(process.cwd(), process.env.ROLLDOWN_DECORATORS_BENCH_ENTRY)
	: resolve(packageRoot, "dist/rolldown-decorators.js");
const { rolldownDecorators } = await import(pathToFileURL(entry).href);

const noHitSource = [
	`export const contact = "person@example.com"; // @notADecorator`,
	...Array.from(
		{ length: 128 },
		(_value, index) =>
			`export function operation${index}(value${index}) { const offset${index} = ${index}; return { value${index}, offset${index} }; }`,
	),
].join("\n");

const decoratedSource = (count) =>
	[
		"function decorate(value) { return value; }",
		...Array.from(
			{ length: count },
			(_value, index) => `
@decorate
export class Subject${index} {
	@decorate field${index} = ${index};
	@decorate method${index}() { return this.field${index}; }
	@decorate static staticMethod${index}() { return ${index}; }
}`,
		),
	].join("\n");

const workloads = [
	{ iterations: 25, name: "no-hit-large", source: noHitSource },
	{ iterations: 100, name: "decorated-8", source: decoratedSource(8) },
	{ iterations: 15, name: "decorated-32", source: decoratedSource(32) },
];

for (const { iterations, name, source } of workloads) {
	const plugin = rolldownDecorators();
	const transform = () => plugin.transform.handler.call({}, source, `${name}.js`);
	const initial = await transform();

	if (name === "no-hit-large") {
		if (initial !== null) {
			throw new Error("Expected the no-hit transform to return null");
		}
	} else if (
		initial === null ||
		typeof initial !== "object" ||
		typeof initial.code !== "string" ||
		initial.code.includes("@decorate") ||
		!initial.code.includes("virtual:@serve-tools/rolldown-decorators/runtime") ||
		!initial.code.includes(`class Subject${name === "decorated-8" ? 7 : 31}`)
	) {
		throw new Error(`Unexpected ${name} transform output`);
	}

	await benchmark(`rolldown-decorators/transform-${name}`, transform, {
		iterations,
		samples: 15,
		warmup: 5,
	});
}
