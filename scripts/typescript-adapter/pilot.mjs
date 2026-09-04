import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { build, createServer } from "vite";
import { typescriptProject } from "./plugin.mjs";

/** Run preparation before loading Vite configuration, then enable the internal adapter for one invocation. */
export async function runPilot({ root, configFile = "tsconfig.json", mode = "dev", prepare, vite = {} }) {
	root = path.resolve(root);
	if (mode !== "dev" && mode !== "build") {
		throw new Error(`Unsupported pilot mode: ${mode}`);
	}
	await prepare?.();
	const plugin = await typescriptProject({ configFile: path.resolve(root, configFile), cwd: root });
	const config = {
		...vite,
		root,
		plugins: [plugin, ...(vite.plugins ?? [])],
		server: { ...vite.server, forwardConsole: true },
	};
	try {
		if (mode === "build") {
			try {
				return await build(config);
			} finally {
				await plugin.api.dispose();
			}
		}
		const server = await createServer(config);
		const close = server.close.bind(server);
		server.close = async () => {
			try {
				await close();
			} finally {
				await plugin.api.dispose();
			}
		};
		await server.listen();
		return server;
	} catch (error) {
		await plugin.api.dispose();
		throw error;
	}
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
	const args = process.argv.slice(2);
	if (args.some((argument) => argument !== "--build")) {
		throw new Error("Usage: node scripts/typescript-adapter/pilot.mjs [--build]");
	}
	const mode = args.includes("--build") ? "build" : "dev";
	const result = await runPilot({
		root: fileURLToPath(new URL("../../client/keyboard/demo/", import.meta.url)),
		mode,
	});
	if (mode === "dev") {
		result.printUrls();
		const close = () => {
			void result.close();
		};
		process.once("SIGINT", close);
		process.once("SIGTERM", close);
	}
}
