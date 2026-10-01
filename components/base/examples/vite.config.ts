import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

const manifest = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
const sourceAliases = Object.entries(manifest.exports as Record<string, string>).map(([entry, target]) => ({
	find: new RegExp(
		`^${`${manifest.name}${entry === "." ? "" : entry.slice(1)}`.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`,
	),
	replacement: fileURLToPath(new URL(target.replace("./dist/", "../src/").replace(/\.js$/, ".ts"), import.meta.url)),
}));

export default defineConfig(({ command }) => ({
	base: "./",
	resolve: { alias: sourceAliases },
	define: {
		__BASE_GALLERY_ROOT__: JSON.stringify(
			command === "serve" ? fileURLToPath(new URL("../", import.meta.url)) : "",
		),
	},
	server: { host: "127.0.0.1" },
	plugins: [
		{
			name: "reload-gallery-source",
			handleHotUpdate({ file, server }) {
				// Recreate custom-element registrations and the captured markup together.
				if (
					file.startsWith(fileURLToPath(new URL("../src/", import.meta.url))) ||
					file.startsWith(fileURLToPath(new URL("./", import.meta.url)))
				) {
					server.ws.send({ type: "full-reload" });
					return [];
				}
			},
		},
	],
	build: {
		outDir: fileURLToPath(new URL("../../../dist/base-gallery", import.meta.url)),
		emptyOutDir: true,
		rolldownOptions: {
			input: {
				gallery: fileURLToPath(new URL("./index.html", import.meta.url)),
				template: fileURLToPath(new URL("./template.html", import.meta.url)),
			},
		},
	},
}));
