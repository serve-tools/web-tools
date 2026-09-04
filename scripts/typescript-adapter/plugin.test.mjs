import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { rolldown } from "rolldown";
import { createBrowserFixture } from "./browser-fixture.mjs";
import { typescriptProject } from "./plugin.mjs";

const compiler = fileURLToPath(new URL("../../node_modules/typescript/bin/tsc", import.meta.url));

test("one-shot bundles and refreshed generations preserve CLI outputs and transitive semantics", {
	timeout: 60_000,
}, async () => {
	const fixture = await createBrowserFixture();
	const builds = [];
	let plugin;
	try {
		plugin = await typescriptProject({ configFile: fixture.configFile, cwd: fixture.root });
		const bundle = async (input = path.join(fixture.root, "a/dist/index.js")) => {
			const build = await rolldown({ input, plugins: [plugin] });
			builds.push(build);
			const { output } = await build.generate({ format: "es", sourcemap: true });
			const chunk = output.find((item) => item.type === "chunk");
			return import(`data:text/javascript;base64,${Buffer.from(chunk.code).toString("base64")}`);
		};
		const first = await bundle();
		assert.equal(first.result, 10);
		assert.equal(first.decoratorResult, "decorated");
		await fixture.assertNoDist();

		const cli = spawnSync(process.execPath, [compiler, "--build", fixture.configFile], {
			cwd: fixture.root,
			encoding: "utf8",
			timeout: 30_000,
		});
		assert.equal(cli.status, 0, cli.stdout + cli.stderr);
		for (const [file, output] of plugin.api.generation.outputs) {
			assert.equal(await readFile(file, "utf8"), output.text, file);
		}

		await fixture.writeDependency(7);
		await plugin.api.refresh({ changed: [fixture.dependency] });
		assert.equal((await bundle()).result, 50);
		assert.match(await readFile(path.join(fixture.root, "c/dist/index.js"), "utf8"), /factor = 3/);

		await fixture.writeCompilerError();
		await assert.rejects(plugin.api.refresh({ changed: [fixture.dependency] }), /2322|not assignable/);
		assert.ok(plugin.api.error);
		await assert.rejects(plugin.load.handler(path.join(fixture.root, "a/dist/index.js")), /2322|not assignable/);
		await fixture.writeDependency(9);
		await plugin.api.refresh({ changed: [fixture.dependency] });
		assert.equal((await bundle()).result, 82);
		assert.equal(plugin.api.error, undefined);

		const privateEntry = path.join(fixture.root, "private.js");
		await writeFile(privateEntry, 'import "@fixture/b/private";');
		await assert.rejects(bundle(privateEntry), /not exported/);
	} finally {
		await Promise.all(builds.map((build) => build.close()));
		await plugin?.api.dispose();
		await fixture.dispose();
	}
});

test("explicit bundler externalization remains external", { timeout: 30_000 }, async () => {
	const fixture = await createBrowserFixture();
	let plugin;
	let build;
	try {
		plugin = await typescriptProject({ configFile: fixture.configFile, cwd: fixture.root });
		const entry = path.join(fixture.root, "external.js");
		await writeFile(entry, 'export { result } from "@fixture/a";');
		build = await rolldown({ input: entry, plugins: [plugin], external: ["@fixture/a"] });
		const { output } = await build.generate({ format: "es" });
		assert.deepEqual(output[0].imports, ["@fixture/a"]);
	} finally {
		await build?.close();
		if (plugin) {
			const disposal = plugin.api.dispose();
			assert.equal(plugin.api.dispose(), disposal);
			await disposal;
		}
		await fixture.dispose();
	}
});
