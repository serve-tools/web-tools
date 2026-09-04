import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { typescript } from "@serve-tools/rolldown-typescript";
import { rolldown } from "rolldown";
import { build as viteBuild } from "vite";
import { createBrowserFixture } from "./browser-fixture.mjs";

test("Vite client and SSR builds use their environment-specific export conditions", { timeout: 60_000 }, async () => {
	assert.equal(await bundleConditionalExport(false), "browser");
	assert.equal(await bundleConditionalExport(true), "node");
});

test("side-effect metadata controls actual bundle execution", { timeout: 60_000 }, async () => {
	assert.equal(await bundleSideEffect(false), "absent");
	assert.equal(await bundleSideEffect(["./dist/value.js"]), "present");
});

test("a refreshed package export selects the current compiler output", { timeout: 60_000 }, async () => {
	const fixture = await createBrowserFixture();
	const builds = [];
	let plugin;
	try {
		const entry = path.join(fixture.root, "package-export-entry.js");
		await writeFile(entry, 'export { result } from "@fixture/a";\n');
		plugin = typescript({ configFile: fixture.configFile, cwd: fixture.root });
		assert.equal(await bundleExport(entry, plugin, builds, "result"), 10);

		const alternateSource = path.join(fixture.root, "a/src/alternate.ts");
		const packageFile = path.join(fixture.root, "a/package.json");
		const manifest = JSON.parse(await readFile(packageFile, "utf8"));
		manifest.exports = { ".": "./dist/alternate.js" };
		await Promise.all([
			writeFile(alternateSource, "export const result = 123;\n"),
			writeFile(packageFile, JSON.stringify(manifest)),
		]);
		await plugin.api.refresh({ created: [alternateSource], changed: [packageFile] });

		assert.equal(await bundleExport(entry, plugin, builds, "result"), 123);
	} finally {
		await Promise.all(builds.map((bundle) => bundle.close()));
		await plugin?.api.dispose();
		await fixture.dispose();
	}
});

test("a newly referenced external project remains an in-memory bundled dependency", { timeout: 60_000 }, async () => {
	const fixture = await createBrowserFixture();
	const external = await mkdtemp(path.join(os.tmpdir(), "ts-adapter-added-reference-"));
	let plugin;
	let bundle;
	try {
		plugin = typescript({ configFile: fixture.configFile, cwd: fixture.root });
		const source = path.join(external, "src/index.ts");
		const configFile = path.join(external, "tsconfig.json");
		const packageFile = path.join(external, "package.json");
		await mkdir(path.dirname(source), { recursive: true });
		await Promise.all([
			writeFile(source, "export const added = 42;\n"),
			writeFile(
				packageFile,
				JSON.stringify({
					name: "@fixture/d",
					private: true,
					type: "module",
					sideEffects: false,
					exports: { ".": "./dist/index.js" },
				}),
			),
			writeFile(
				configFile,
				JSON.stringify({
					compilerOptions: {
						composite: true,
						declaration: true,
						module: "esnext",
						moduleResolution: "bundler",
						outDir: "dist",
						rootDir: "src",
						strict: true,
						target: "es2022",
						types: [],
					},
					include: ["src"],
				}),
			),
		]);
		await symlink(
			external,
			path.join(fixture.root, "node_modules/@fixture/d"),
			process.platform === "win32" ? "junction" : "dir",
		);
		await writeFile(
			fixture.configFile,
			JSON.stringify({ files: [], references: [{ path: "./a" }, { path: external }] }),
		);
		await plugin.api.refresh({
			created: [source, configFile, packageFile],
			changed: [fixture.configFile],
		});

		const entry = path.join(fixture.root, "added-reference-entry.js");
		await writeFile(entry, 'export { added } from "@fixture/d";\n');
		bundle = await rolldown({ input: entry, plugins: [plugin] });
		const { output } = await bundle.generate({ format: "es" });
		const chunk = output.find((item) => item.type === "chunk");
		assert.deepEqual(chunk.imports, []);
		assert.equal((await importCode(chunk.code)).added, 42);
	} finally {
		await bundle?.close();
		await plugin?.api.dispose();
		await fixture.dispose();
		await rm(external, { recursive: true, force: true });
	}
});

test("one production bundle reads one compiler generation", { timeout: 60_000 }, async () => {
	const fixture = await createBrowserFixture();
	let plugin;
	let bundle;
	try {
		plugin = typescript({ configFile: fixture.configFile, cwd: fixture.root });
		let refreshed = false;
		const refreshDuringTransform = {
			name: "refresh-during-transform",
			async transform(code, id) {
				if (!refreshed && path.normalize(id) === path.join(fixture.root, "b/dist/value.js")) {
					refreshed = true;
					await fixture.writeDependency(7);
					await plugin.api.refresh({ changed: [fixture.dependency] });
				}
				return code;
			},
		};

		bundle = await rolldown({
			input: path.join(fixture.root, "a/dist/index.js"),
			plugins: [plugin, refreshDuringTransform],
		});
		const { output } = await bundle.generate({ format: "es" });
		const chunk = output.find((item) => item.type === "chunk");
		assert.equal(plugin.api.generation.generation, 2);
		assert.equal((await importCode(chunk.code)).result, 10);
	} finally {
		await bundle?.close();
		await plugin?.api.dispose();
		await fixture.dispose();
	}
});

test("a query on a bare public export still resolves through in-memory output", { timeout: 60_000 }, async () => {
	assert.equal((await bundleQuery("?adapter-query", "named")).module.result, 10);
	const raw = await bundleQuery("?raw", "default");
	assert.equal(raw.module.result, raw.emitted);
	await assert.rejects(bundleQuery("?url", "default"), /does not support asset or worker query imports/);
});

async function bundleConditionalExport(ssr) {
	const fixture = await createBrowserFixture();
	let plugin;
	try {
		const packageFile = path.join(fixture.root, "a/package.json");
		const manifest = JSON.parse(await readFile(packageFile, "utf8"));
		manifest.exports = { ".": { browser: "./dist/browser.js", node: "./dist/index.js" } };
		await Promise.all([
			writeFile(packageFile, JSON.stringify(manifest)),
			writeFile(path.join(fixture.root, "a/src/browser.ts"), 'export const environment = "browser";\n'),
			writeFile(path.join(fixture.root, "a/src/index.ts"), 'export const environment = "node";\n'),
		]);
		const entry = path.join(fixture.root, "conditional-entry.js");
		await writeFile(entry, 'export { environment } from "@fixture/a";\n');
		plugin = typescript({ configFile: fixture.configFile, cwd: fixture.root });
		const result = await viteBuild({
			root: fixture.root,
			logLevel: "silent",
			plugins: [plugin],
			build: ssr ? { ssr: entry, write: false } : { lib: { entry, formats: ["es"] }, write: false },
		});
		const output = Array.isArray(result) ? result[0].output : result.output;
		const chunk = output.find((item) => item.type === "chunk");
		return (await importCode(chunk.code)).environment;
	} finally {
		await plugin?.api.dispose();
		await fixture.dispose();
	}
}

async function bundleSideEffect(sideEffects) {
	const fixture = await createBrowserFixture();
	let plugin;
	let bundle;
	try {
		const packageFile = path.join(fixture.root, "b/package.json");
		const sourceFile = path.join(fixture.root, "b/src/value.ts");
		const manifest = JSON.parse(await readFile(packageFile, "utf8"));
		const source = await readFile(sourceFile, "utf8");
		manifest.sideEffects = sideEffects;
		await Promise.all([
			writeFile(packageFile, JSON.stringify(manifest)),
			writeFile(
				sourceFile,
				`(globalThis as Record<string, unknown>).__adapterSideEffect = "present";\n${source}`,
			),
		]);
		const entry = path.join(fixture.root, "side-effect-entry.js");
		await writeFile(
			entry,
			'import "@fixture/b/value";\nexport const observed = globalThis.__adapterSideEffect ?? "absent";\n',
		);
		plugin = typescript({ configFile: fixture.configFile, cwd: fixture.root });
		bundle = await rolldown({ input: entry, plugins: [plugin] });
		const { output } = await bundle.generate({ format: "es" });
		const chunk = output.find((item) => item.type === "chunk");
		delete globalThis.__adapterSideEffect;
		return (await importCode(chunk.code)).observed;
	} finally {
		delete globalThis.__adapterSideEffect;
		await bundle?.close();
		await plugin?.api.dispose();
		await fixture.dispose();
	}
}

async function bundleQuery(query, importKind) {
	const fixture = await createBrowserFixture();
	let plugin;
	try {
		const entry = path.join(fixture.root, "query-entry.js");
		await writeFile(
			entry,
			importKind === "default"
				? `import result from "@fixture/a${query}";\nexport { result };\n`
				: `export { result } from "@fixture/a${query}";\n`,
		);
		plugin = typescript({ configFile: fixture.configFile, cwd: fixture.root });
		const result = await viteBuild({
			root: fixture.root,
			logLevel: "silent",
			plugins: [plugin],
			build: { lib: { entry, formats: ["es"] }, write: false },
		});
		const output = Array.isArray(result) ? result[0].output : result.output;
		const chunk = output.find((item) => item.type === "chunk");
		const emitted = plugin.api.generation.outputs.get(path.join(fixture.root, "a/dist/index.js")).text;
		return { emitted, module: await importCode(chunk.code) };
	} finally {
		await plugin?.api.dispose();
		await fixture.dispose();
	}
}

async function bundleExport(entry, plugin, builds, name) {
	const bundle = await rolldown({ input: entry, plugins: [plugin] });
	builds.push(bundle);
	const { output } = await bundle.generate({ format: "es" });
	const chunk = output.find((item) => item.type === "chunk");
	return (await importCode(chunk.code))[name];
}

function importCode(code) {
	return import(`data:text/javascript;base64,${Buffer.from(code).toString("base64")}`);
}
