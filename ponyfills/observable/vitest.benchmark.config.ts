import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { mergeConfig } from "vitest/config";

import benchmarkConfig from "../../vitest.benchmark.config.js";

const defaultEntry = fileURLToPath(new URL("./dist/ponyfill-observable.js", import.meta.url));
const entry = process.env.OBSERVABLE_BENCH_ENTRY
	? resolve(process.cwd(), process.env.OBSERVABLE_BENCH_ENTRY)
	: defaultEntry;

export default mergeConfig(benchmarkConfig, {
	resolve: {
		alias: [{ find: "../dist/ponyfill-observable.js", replacement: entry }],
	},
	server: {
		fs: {
			allow: [resolve(process.cwd()), dirname(entry)],
		},
	},
});
