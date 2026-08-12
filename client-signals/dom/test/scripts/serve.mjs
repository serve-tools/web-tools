import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { createServer } from "node:http";
import { dirname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const roots = new Map([
	["dom", dirname(fileURLToPath(import.meta.resolve("@serve-tools/signal-dom")))],
	["effect", dirname(fileURLToPath(import.meta.resolve("@serve-tools/signal-effect")))],
	["signal", dirname(fileURLToPath(import.meta.resolve("@serve-tools/signal")))],
]);
const port = Number(process.env.SIGNAL_DOM_TEST_PORT ?? 4173);
const importMap = JSON.stringify({
	imports: {
		"@serve-tools/signal-effect": "/effect/signal-effect.js",
		"@serve-tools/signal": "/signal/signal.js",
	},
});

const server = createServer(async (request, response) => {
	const { pathname } = new URL(request.url ?? "/", `http://${request.headers.host ?? "127.0.0.1"}`);

	if (pathname === "/__test__") {
		response.writeHead(200, { "content-type": "text/html;charset=UTF-8" });
		response.end(`<script type="importmap">${importMap}</script>`);
		return;
	}

	const [, route, ...segments] = pathname.split("/");
	const root = roots.get(route);

	if (root !== undefined) {
		const path = resolve(root, segments.join("/"));

		if (path.startsWith(`${root}${sep}`)) {
			try {
				const file = await stat(path);

				if (file.isFile()) {
					response.writeHead(200, {
						"content-length": file.size,
						"content-type": "application/javascript;charset=UTF-8",
					});
					createReadStream(path).pipe(response);
					return;
				}
			} catch {
				// Fall through to the not-found response.
			}
		}
	}

	response.writeHead(404, { "content-type": "text/plain;charset=UTF-8" });
	response.end("Not Found");
});

server.listen(port, "127.0.0.1", () => {
	console.log(`Signal DOM test server listening at http://127.0.0.1:${port}`);
});
