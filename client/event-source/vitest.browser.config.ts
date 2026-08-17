import { playwright } from "@vitest/browser-playwright";
import { defineConfig } from "vitest/config";

const requests = new Map<string, number>();

export default defineConfig({
	plugins: [
		{
			name: "event-source-test-server",
			configureServer(server) {
				server.middlewares.use("/events", (request, response) => {
					const token = new URL(request.url ?? "", "http://localhost").searchParams.get("token") ?? "";
					const attempt = (requests.get(token) ?? 0) + 1;

					requests.set(token, attempt);
					response.setHeader("Cache-Control", "no-cache");
					response.setHeader("Content-Type", "text/event-stream");

					if (attempt === 1) {
						response.end('retry: 10\nid: event-1\nevent: presence\ndata: {"online":1}\n\n');
					} else {
						response.end(
							`id: event-2\nevent: presence\ndata: ${JSON.stringify({
								online: 2,
								resumedAfter: request.headers["last-event-id"] ?? "",
							})}\n\n`,
						);
					}
				});
			},
		},
	],
	test: {
		include: ["test/browser/**/*.test.ts"],
		testTimeout: 10_000,
		browser: {
			enabled: true,
			headless: true,
			provider: playwright(),
			instances: [{ browser: "chromium" }, { browser: "firefox" }, { browser: "webkit" }],
		},
	},
});
