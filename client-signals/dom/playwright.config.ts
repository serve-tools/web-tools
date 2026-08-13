import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
	projects: [
		{ name: "chromium", use: { ...devices["Desktop Chrome"] } },
		{ name: "firefox", use: { ...devices["Desktop Firefox"] } },
		{ name: "webkit", use: { ...devices["Desktop Safari"] } },
	],
	testDir: "test/browser",
	use: {
		baseURL: "http://127.0.0.1:4173",
		headless: true,
	},
	webServer: {
		command: "SIGNAL_DOM_TEST_PORT=4173 node test/scripts/serve.mjs",
		reuseExistingServer: !process.env.CI,
		url: "http://127.0.0.1:4173/__test__",
	},
});
