import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { createBrowserFixture } from "./browser-fixture.mjs";
import { runPilot } from "./pilot.mjs";

test("pilot prepares config-time compiler dependencies and generated assets before loading Vite", {
	timeout: 30_000,
}, async () => {
	const fixture = await createBrowserFixture();
	try {
		await mkdir(path.join(fixture.root, "config-tool/src"), { recursive: true });
		await writeFile(
			path.join(fixture.root, "config-tool/src/index.ts"),
			'export const marker = "prepared config";',
		);
		await writeFile(
			path.join(fixture.root, "config-tool/tsconfig.json"),
			JSON.stringify({
				compilerOptions: { module: "esnext", rootDir: "src", outDir: "dist", types: [] },
				include: ["src"],
			}),
		);
		await writeFile(
			path.join(fixture.root, "vite.config.mjs"),
			'import { marker } from "./config-tool/dist/index.js";\n' +
				'if (marker !== "prepared config") throw new Error("configuration not prepared");\n' +
				"export default { build: { minify: false } };\n",
		);
		const output = await runPilot({
			root: fixture.root,
			mode: "build",
			async prepare() {
				const compiler = fileURLToPath(new URL("../../node_modules/typescript/bin/tsc", import.meta.url));
				const result = spawnSync(process.execPath, [compiler, "--build", "config-tool/tsconfig.json"], {
					cwd: fixture.root,
					encoding: "utf8",
					timeout: 15_000,
				});
				assert.equal(result.status, 0, result.stdout + result.stderr);
				await writeFile(
					path.join(fixture.root, "generated/asset.js"),
					'export const asset = "generated before bundle";',
				);
			},
			vite: { logLevel: "silent", build: { write: false } },
		});
		const chunks = output.output.filter((item) => item.type === "chunk");
		assert.equal(chunks.length, 1);
		assert.match(chunks[0].code, /generated before bundle/);
		assert.match(chunks[0].code, /decorated/);
		await fixture.assertNoDist();
	} finally {
		await fixture.dispose();
	}
});
