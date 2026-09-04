import { resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { benchmark } from "../../../client/benchmark.ts";

const packageRoot = fileURLToPath(new URL("..", import.meta.url));
const entry = process.env.VITE_POLYFILLS_BENCH_ENTRY
	? resolve(process.cwd(), process.env.VITE_POLYFILLS_BENCH_ENTRY)
	: resolve(packageRoot, "dist/vite-polyfills.js");
const entryURL = pathToFileURL(entry).href;
const arguments_ = process.argv.slice(2);
const workloadIndex = arguments_.indexOf("--workload");
const requestedWorkload = workloadIndex < 0 ? undefined : arguments_[workloadIndex + 1];

if (workloadIndex >= 0 && !requestedWorkload) {
	throw new TypeError("Expected a workload name after --workload.");
}

const benchmarkOptions = (iterations) => ({ iterations, samples: 15, warmup: 5 });
const assertPlugin = (plugin) => {
	if (
		plugin.name !== "vite-plugin-polyfills" ||
		typeof plugin.resolveId !== "function" ||
		typeof plugin.load !== "function" ||
		!plugin.transform
	) {
		throw new Error("Expected the public entry to create a complete Vite polyfills plugin");
	}
};

process.stdout.write(`[benchmark-subject] ${JSON.stringify({ entry })}\n`);

if (requestedWorkload === "cold-import-plugin-create") {
	await benchmark(
		"vite-polyfills/cold-import-plugin-create",
		async () => {
			const { vitePolyfills } = await import(entryURL);
			const plugin = vitePolyfills();

			assertPlugin(plugin);
		},
		{ iterations: 1, samples: 1, warmup: 0 },
	);

	process.exit(0);
}

const { vitePolyfills } = await import(entryURL);

const workloads = {
	"plugin-create": () =>
		benchmark(
			"vite-polyfills/plugin-create",
			() => {
				assertPlugin(vitePolyfills());
			},
			benchmarkOptions(10_000),
		),
	"transform-no-hit": () =>
		transformBenchmark(vitePolyfills, "transform-no-hit", "export const double = (value) => value * 2;", [], 1_000),
	"transform-single-hit": () =>
		transformBenchmark(
			vitePolyfills,
			"transform-single-hit",
			"export const schedule = (work) => requestIdleCallback(work);",
			["request-idle-callback"],
			500,
		),
	"transform-multi-hit": () =>
		transformBenchmark(
			vitePolyfills,
			"transform-multi-hit",
			[
				'const cache = new Map(); export const key = Composite({ scope: "main", id: 1 });',
				'export const value = cache.getOrInsert(key, "ready");',
				'export const events = new EventTarget().when("change");',
				"export const controller = new TaskController();",
				"export const stream = new Observable(() => {});",
				"export const dispose = Symbol.dispose;",
			].join("\n"),
			["composite", "event-target-when", "map-upsert", "observable", "symbol-dispose", "task-controller"],
			200,
		),
};

if (requestedWorkload && !(requestedWorkload in workloads)) {
	throw new TypeError(`Unknown workload: ${requestedWorkload}`);
}

for (const [name, run] of Object.entries(workloads)) {
	if (!requestedWorkload || requestedWorkload === name) {
		await run();
	}
}

async function transformBenchmark(vitePolyfills, name, code, expectedPolyfills, iterations) {
	const plugin = vitePolyfills();
	const transform = typeof plugin.transform === "function" ? plugin.transform : plugin.transform?.handler;

	if (typeof transform !== "function") {
		throw new Error("Expected a callable public transform hook");
	}

	const operation = () => {
		const transformed = transform.call({}, code, "benchmark-entry.js");
		const validate = (result) => {
			if (expectedPolyfills.length === 0) {
				if (result !== null) {
					throw new Error("Expected the no-hit transform to return null");
				}

				return;
			}

			if (!result || typeof result.code !== "string" || !result.code.includes(code)) {
				throw new Error("Expected transformed code to preserve the source module");
			}

			for (const id of expectedPolyfills) {
				if (!result.code.includes(`import"virtual:@serve-tools/vite-polyfill/${id}";`)) {
					throw new Error(`Expected transformed code to import ${id}`);
				}
			}
		};

		if (transformed instanceof Promise) {
			return transformed.then(validate);
		}

		validate(transformed);
	};

	await benchmark(`vite-polyfills/${name}`, operation, benchmarkOptions(iterations));
}
