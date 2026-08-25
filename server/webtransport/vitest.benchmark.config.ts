import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		include: ["benchmark/**/*.benchmark.ts"],
		environment: "node",
		reporters: [fileURLToPath(new URL("../../client/benchmark-reporter.ts", import.meta.url))],
		testTimeout: 120_000,
	},
});
