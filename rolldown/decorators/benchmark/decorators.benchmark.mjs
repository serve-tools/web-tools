import { resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { benchmark } from "../../../client/benchmark.ts";

const packageRoot = fileURLToPath(new URL("..", import.meta.url));
const runtime = process.env.ROLLDOWN_DECORATORS_BENCH_RUNTIME
	? resolve(process.cwd(), process.env.ROLLDOWN_DECORATORS_BENCH_RUNTIME)
	: resolve(packageRoot, "dist/decorators.js");
const { _apply_decorators: applyDecorators } = await import(pathToFileURL(runtime).href);

const Kind = {
	CLASS: 0,
	METHOD: 1,
	FIELD: 2,
};
const kindNames = ["class", "method", "field"];
const bucketOf = ({ kind, isStatic }) =>
	kind === Kind.CLASS ? 4 : kind === Kind.FIELD ? (isStatic ? 2 : 3) : isStatic ? 0 : 1;

const definitions = Array.from({ length: 32 }, (_value, index) => ({
	kind: index === 31 ? Kind.CLASS : index % 3 === 2 ? Kind.FIELD : Kind.METHOD,
	name: index === 31 ? "Subject" : `member${index}`,
	isStatic: index !== 31 && index % 4 === 0,
}));

for (const count of [8, 32]) {
	const selected = definitions.slice(0, count - 1).concat(definitions.at(-1));
	const expectedOrder = selected
		.toSorted((left, right) => bucketOf(left) - bucketOf(right))
		.map(({ kind, name, isStatic }) => `${kindNames[kind]}:${name}:${Boolean(isStatic)}`)
		.join(",");

	await benchmark(
		`rolldown-decorators/apply-mixed-${count}`,
		() => {
			const calls = [];
			const decorator = (_value, context) => {
				calls.push(`${context.kind}:${String(context.name)}:${Boolean(context.static)}`);
			};
			class Subject {}

			for (const { kind, name, isStatic } of selected) {
				if (kind === Kind.METHOD) {
					Object.defineProperty(isStatic ? Subject : Subject.prototype, name, {
						configurable: true,
						value() {},
						writable: true,
					});
				}
			}

			const entries = selected.map(({ kind, name, isStatic }) => [[decorator], kind, name, isStatic, false]);
			const result = applyDecorators(Subject, ...entries);

			if (result !== Subject || calls.join(",") !== expectedOrder) {
				throw new Error(`Expected stable mixed decorator application for ${count} entries`);
			}
		},
		{ iterations: count === 8 ? 3_000 : 1_000, samples: 15, warmup: 5 },
	);
}
