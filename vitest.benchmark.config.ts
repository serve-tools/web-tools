import { fileURLToPath } from "node:url";
import { playwright } from "@vitest/browser-playwright";
import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		include: ["benchmark/**/*.benchmark.ts"],
		fileParallelism: false,
		reporters: [fileURLToPath(new URL("./client/benchmark-reporter.ts", import.meta.url))],
		testTimeout: 120_000,
		browser: {
			enabled: true,
			headless: true,
			provider: playwright(),
			instances: [{ browser: "chromium" }],
		},
	},
});
