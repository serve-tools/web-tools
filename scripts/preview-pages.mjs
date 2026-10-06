import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../dist/pages/", import.meta.url));
const mimeTypes = {
	".html": "text/html; charset=utf-8",
	".js": "text/javascript; charset=utf-8",
	".css": "text/css; charset=utf-8",
	".json": "application/json; charset=utf-8",
	".svg": "image/svg+xml",
	".png": "image/png",
	".woff2": "font/woff2",
};

/** Serves the built review site on loopback only, without exposing repository files. */
export function createPagesPreview(pagesDirectory = root) {
	const directory = resolve(pagesDirectory);
	return createServer(async (request, response) => {
		try {
			if (request.method !== "GET" && request.method !== "HEAD") {
				response.writeHead(405, { Allow: "GET, HEAD" }).end();
				return;
			}
			const url = new URL(request.url, "http://localhost");
			let path = resolve(directory, `.${decodeURIComponent(url.pathname)}`);
			const fromRoot = relative(directory, path);
			if (fromRoot === ".." || fromRoot.startsWith(`..${sep}`) || isAbsolute(fromRoot)) {
				response.writeHead(403).end("Forbidden");
				return;
			}
			if ((await stat(path)).isDirectory()) {
				if (!url.pathname.endsWith("/")) {
					response.writeHead(308, { Location: `${url.pathname}/${url.search}` }).end();
					return;
				}
				path = join(path, "index.html");
			}
			const file = await stat(path);
			if (!file.isFile()) {
				response.writeHead(404).end("Not found");
				return;
			}
			response.writeHead(200, {
				"Content-Type": mimeTypes[extname(path)] ?? "application/octet-stream",
				"Content-Length": file.size,
				"Cache-Control": "no-store",
				"X-Content-Type-Options": "nosniff",
			});
			if (request.method === "HEAD") {
				response.end();
			} else {
				createReadStream(path)
					.on("error", () => response.destroy())
					.pipe(response);
			}
		} catch {
			response.writeHead(404).end("Not found");
		}
	});
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
	await stat(join(root, "index.html"));
	const server = createPagesPreview();
	server.listen(4173, "127.0.0.1", () => {
		console.log("Review the entire site at http://127.0.0.1:4173/ (local only; no publication).");
	});
}
