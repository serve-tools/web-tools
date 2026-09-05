import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { typescript } from "@serve-tools/rolldown-typescript";
import { rolldown } from "rolldown";
import { createServer } from "vite";
import { createBrowserFixture } from "./browser-fixture.mjs";

const compiler = fileURLToPath(new URL("../../node_modules/typescript/bin/tsc", import.meta.url));

test("the synchronous plugin waits for compilation before Vite discovers dependencies", {
	timeout: 30_000,
}, async () => {
	const fixture = await createBrowserFixture();
	const plugin = typescript({ configFile: fixture.configFile, cwd: fixture.root });
	try {
		assert.equal(typeof plugin, "object");
		assert.equal(plugin.then, undefined);
		assert.equal(plugin.api.generation, undefined);
		const config = await plugin.config({});
		assert.ok(config.optimizeDeps.exclude.includes("@fixture/a"));
		assert.ok(config.optimizeDeps.exclude.includes("@fixture/b"));
		assert.equal(plugin.api.statistics.refreshes, 1);
		await plugin.buildStart.call({ addWatchFile() {} });
		assert.equal(plugin.api.statistics.refreshes, 1, "the first build shares initialization");
		plugin.buildEnd.call({});
		await plugin.buildStart.call({ addWatchFile() {} });
		assert.equal(plugin.api.statistics.refreshes, 2, "subsequent builds still refresh the compiler");
		await fixture.assertNoDist();
	} finally {
		await plugin.api.dispose();
		await fixture.dispose();
	}
});

test("disposal before initialization finishes skips compilation and closes the compiler", {
	timeout: 30_000,
}, async () => {
	const fixture = await createBrowserFixture();
	const plugin = typescript({ configFile: fixture.configFile, cwd: fixture.root });
	try {
		const disposal = plugin.api.dispose();
		assert.equal(plugin.api.dispose(), disposal);
		await disposal;
		assert.equal(plugin.api.statistics.refreshes, 0);
		await assert.rejects(plugin.config({}), /disposed/);
		await assert.rejects(plugin.buildStart.call({ addWatchFile() {} }), /disposed/);
		await fixture.assertNoDist();
	} finally {
		await plugin.api.dispose();
		await fixture.dispose();
	}
});

test("initial compiler errors reject Vite and Rolldown startup", { timeout: 30_000 }, async () => {
	const fixture = await createBrowserFixture();
	const plugins = [];
	let build;
	try {
		await fixture.writeCompilerError();
		const vitePlugin = typescript({ configFile: fixture.configFile, cwd: fixture.root });
		plugins.push(vitePlugin);
		await assert.rejects(
			createServer({
				root: fixture.root,
				configFile: false,
				logLevel: "silent",
				plugins: [vitePlugin],
				server: { middlewareMode: true, hmr: false },
			}),
			/2322|not assignable/,
		);
		const rolldownPlugin = typescript({ configFile: fixture.configFile, cwd: fixture.root });
		plugins.push(rolldownPlugin);
		build = await rolldown({
			input: path.join(fixture.root, "a/dist/index.js"),
			plugins: [rolldownPlugin],
		});
		await assert.rejects(build.generate({ format: "es" }), /2322|not assignable/);
		await fixture.assertNoDist();
	} finally {
		await build?.close();
		await Promise.all(plugins.map((plugin) => plugin.api.dispose()));
		await fixture.dispose();
	}
});

test("an initialization rejection is observed immediately and cleans up without host ownership", {
	timeout: 30_000,
}, async () => {
	const fixture = await createBrowserFixture();
	try {
		await fixture.writeCompilerError();
		const result = spawnSync(
			process.execPath,
			[
				"--input-type=module",
				"-e",
				`
import assert from "node:assert/strict";
import { setTimeout } from "node:timers/promises";
import { typescript } from "@serve-tools/rolldown-typescript";
const plugin = typescript(${JSON.stringify({ configFile: fixture.configFile, cwd: fixture.root })});
while (!plugin.api.error) await setTimeout(10);
await setTimeout(25);
await assert.rejects(plugin.config({}), /2322|not assignable/);
// No explicit disposal: failed initialization must release the native session itself.
`,
			],
			{ encoding: "utf8", timeout: 20_000 },
		);
		assert.equal(result.status, 0, result.error?.message ?? result.stderr);
	} finally {
		await fixture.dispose();
	}
});

test("closing a Vite middleware server disposes its compiler without an HTTP close event", {
	timeout: 30_000,
}, async () => {
	const fixture = await createBrowserFixture();
	let plugin;
	let server;
	try {
		plugin = typescript({ configFile: fixture.configFile, cwd: fixture.root });
		server = await createServer({
			root: fixture.root,
			configFile: false,
			logLevel: "silent",
			plugins: [plugin],
			server: { middlewareMode: true, hmr: false },
		});
		assert.equal(server.httpServer, null);
		assert.equal((await server.ssrLoadModule(path.join(fixture.root, "a/src/index.ts"))).result, 10);
		await server.close();
		await assert.rejects(plugin.api.refresh(), /disposed/);
		await fixture.assertNoDist();
	} finally {
		await server?.close();
		await plugin?.api.dispose();
		await fixture.dispose();
	}
});

test("one-shot bundles and refreshed generations preserve CLI outputs and transitive semantics", {
	timeout: 60_000,
}, async () => {
	const fixture = await createBrowserFixture();
	const builds = [];
	let plugin;
	try {
		plugin = typescript({ configFile: fixture.configFile, cwd: fixture.root });
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
		plugin = typescript({ configFile: fixture.configFile, cwd: fixture.root });
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

test("slash-form hot updates refresh dependencies and invalidate emitted modules with query suffixes", {
	timeout: 30_000,
}, async () => {
	const fixture = await createBrowserFixture();
	let plugin;
	let build;
	try {
		plugin = typescript({ configFile: fixture.configFile, cwd: fixture.root });
		const slashPath = (file) => file.split(path.sep).join("/");
		const entry = { id: `${slashPath(path.join(fixture.root, "a/dist/index.js"))}?v=1` };
		const consumer = { id: `${slashPath(path.join(fixture.root, "b/dist/value.js"))}#fragment` };
		const virtual = { id: "\0virtual-module" };
		const invalidated = [];
		const timestamp = 1234;
		const moduleGraph = {
			idToModuleMap: new Map([entry, consumer, virtual].map((module) => [module.id, module])),
			invalidateModule(module, seen, updatedAt, isHmr) {
				assert.ok(seen instanceof Set);
				assert.equal(updatedAt, timestamp);
				assert.equal(isHmr, true);
				invalidated.push(module);
			},
		};

		await plugin.config({});
		await fixture.writeDependency(7);
		const refreshes = plugin.api.statistics.refreshes;
		const modules = await plugin.hotUpdate.call(
			{ environment: { moduleGraph } },
			{
				type: "update",
				file: slashPath(fixture.dependency),
				modules: [],
				timestamp,
			},
		);
		assert.equal(plugin.api.statistics.refreshes, refreshes + 1);
		assert.deepEqual(invalidated, [entry, consumer]);
		assert.deepEqual(modules, [entry, consumer]);

		build = await rolldown({ input: path.join(fixture.root, "a/dist/index.js"), plugins: [plugin] });
		const { output } = await build.generate({ format: "es" });
		const chunk = output.find((item) => item.type === "chunk");
		const bundled = await import(`data:text/javascript;base64,${Buffer.from(chunk.code).toString("base64")}`);
		assert.equal(bundled.result, 50);
		await fixture.assertNoDist();
	} finally {
		await build?.close();
		await plugin?.api.dispose();
		await fixture.dispose();
	}
});
