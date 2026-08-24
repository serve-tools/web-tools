import { mergeConfig } from "vitest/config";
import { browserConfig } from "../../vitest.browser.config.js";

const sourceCounts = new Map<string, number>();

export default mergeConfig(browserConfig, {
	plugins: [
		{
			name: "shared-event-source-test-server",
			configureServer(server) {
				server.middlewares.use("/__shared-event-source", (request, response) => {
					const name = new URL(request.url ?? "", "http://localhost").searchParams.get("name") ?? "";
					const sourceCount = (sourceCounts.get(name) ?? 0) + 1;

					sourceCounts.set(name, sourceCount);
					response.setHeader("Cache-Control", "no-cache");
					response.setHeader("Content-Type", "text/event-stream");

					let sequence = 0;

					const timer = setInterval(() => {
						response.write(
							`event: presence\ndata: ${JSON.stringify({ sequence: ++sequence, sourceCount })}\n\n`,
						);
					}, 100);

					request.on("close", () => clearInterval(timer));
				});
			},
		},
	],
});
