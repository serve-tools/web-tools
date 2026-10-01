import { defineBrowserCommand } from "@vitest/browser-playwright";
import { defineConfig, mergeConfig } from "vitest/config";
import { browserConfig } from "../../vitest.browser.config.js";

// Keyboard and modal tests must not compete for browser focus across concurrently running files.
export default mergeConfig(
	browserConfig,
	defineConfig({
		test: {
			browser: {
				commands: {
					setForcedColors: defineBrowserCommand(async ({ page }, active: boolean) => {
						await page.emulateMedia({ forcedColors: active ? "active" : "none" });
					}),
				},
			},
			fileParallelism: false,
			setupFiles: ["@serve-tools/polyfill-resource-management/apply/DisposableStack"],
		},
	}),
);
