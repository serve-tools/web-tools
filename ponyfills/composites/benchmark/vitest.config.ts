import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { mergeConfig } from "vitest/config";

import benchmarkConfig from "../../../vitest.benchmark.config.js";

const packageRoot = fileURLToPath(new URL("..", import.meta.url));
const defaultEntry = fileURLToPath(new URL("../dist/ponyfill-composites.js", import.meta.url));
const entry = process.env.COMPOSITES_BENCH_ENTRY
	? resolve(process.cwd(), process.env.COMPOSITES_BENCH_ENTRY)
	: defaultEntry;

export default mergeConfig(benchmarkConfig, {
	root: packageRoot,
	resolve: {
		alias: [{ find: "../dist/ponyfill-composites.js", replacement: entry }],
	},
	server: {
		fs: {
			allow: [packageRoot, dirname(entry)],
		},
	},
});
