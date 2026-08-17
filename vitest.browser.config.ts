import { playwright } from "@vitest/browser-playwright";
import { defineConfig } from "vitest/config";

const browser = () => ({
	enabled: true,
	headless: true,
	provider: playwright(),
	instances: [{ browser: "chromium" as const }, { browser: "firefox" as const }, { browser: "webkit" as const }],
});

export const browserConfig = defineConfig({
	test: { include: ["test/browser/**/*.test.ts"], testTimeout: 10_000, browser: browser() },
});
export const recursiveBrowserConfig = defineConfig({ test: { include: ["test/**/*.test.ts"], browser: browser() } });
export const timedBrowserConfig = defineConfig({
	test: { include: ["test/**/*.test.ts"], testTimeout: 10_000, browser: browser() },
});
export const conformanceBrowserConfig = defineConfig({
	test: { include: ["test/conformance.test.ts"], testTimeout: 10_000, browser: browser() },
});
