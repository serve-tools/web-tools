import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		projects: [
			"client/*/vitest.config.ts",
			"client-signals/*/vitest.config.ts",
			"core/*/vitest.config.ts",
			"polyfills/*/vitest.config.ts",
			"ponyfills/*/vitest.config.ts",
			"realtime/*/vitest.config.ts",
			"server/*/vitest.config.ts",
			"signals/*/vitest.config.ts",
			"vite/*/vitest.config.ts",
		],
	},
});
