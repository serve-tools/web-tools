import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, realpath, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { API } from "typescript/unstable/async";
import { CompilerSessionError, createCompilerSession } from "../../rolldown/typescript/src/internal/session.mjs";

const compiler = fileURLToPath(new URL("../../node_modules/typescript/bin/tsc", import.meta.url));
const compilerVersion = JSON.parse(
	await readFile(new URL("../../node_modules/typescript/package.json", import.meta.url), "utf8"),
).version;

test("emits a referenced graph with CLI parity and updates one atomic generation at a time", async (context) => {
	const fixture = await createFixture();
	context.after(() => rm(fixture.root, { force: true, recursive: true }));
	const session = await createCompilerSession({ configFile: fixture.configFile, cwd: fixture.root });
	context.after(() => session.dispose());

	assert.equal(session.compilerVersion, compilerVersion);
	const initial = await session.refresh();
	assert.equal(initial.generation, 1);
	assert.equal(initial.projects.length, 4);
	assert.equal(initial.outputs.size, 12);
	assert.equal(initial.diagnostics.length, 0);
	assert.equal(initial.timing.apiRequestCount > 0, true);
	for (const key of ["configurationMs", "diagnosticsMs", "emitMs", "totalMs"]) {
		assert.equal(initial.timing[key] >= 0, true, key);
	}
	for (const [file, output] of initial.outputs) {
		assert.equal(path.isAbsolute(file), true);
		assert.equal(path.isAbsolute(output.sourceFileName), true);
		assert.deepEqual(output.sourceFiles, [output.sourceFileName]);
		assert.equal(output.sourceText, initial.sourcesContent.get(output.sourceFileName));
		assert.equal(path.isAbsolute(output.projectConfigFile), true);
	}
	for (const name of ["a", "b", "c"]) {
		assert.equal(existsSync(path.join(fixture.root, name, "dist")), false);
	}

	const cProject = initial.projects.find(({ configFile }) => configFile === fixture.configs.c);
	assert.ok(cProject);
	assert.deepEqual(cProject.rootNames, [fixture.sources.c]);
	assert.equal(cProject.configDirectory, path.dirname(fixture.configs.c));
	assert.ok(cProject.configFileNames.includes(fixture.baseConfig));
	assert.equal(cProject.packageFile, path.join(fixture.root, "c/package.json"));
	assert.ok(initial.watchedFiles.includes(fixture.baseConfig));
	assert.ok(initial.watchedFiles.includes(path.join(fixture.root, "c/package.json")));

	const cli = spawnSync(process.execPath, [compiler, "--build", fixture.configFile, "--force", "--pretty", "false"], {
		cwd: fixture.root,
		encoding: "utf8",
		timeout: 30_000,
	});
	assert.equal(cli.status, 0, cli.stdout + cli.stderr);
	for (const [file, { text }] of initial.outputs) {
		assert.equal(await readFile(file, "utf8"), text, file);
	}

	const bOutput = path.join(fixture.root, "b/dist/value.js");
	assert.match(initial.outputs.get(bOutput).text, /factor \* 3/);
	await writeFile(fixture.sources.c, dependency(7));
	const updated = await session.refresh({ changed: [fixture.sources.c] });
	assert.equal(updated.generation, 2);
	assert.match(updated.outputs.get(bOutput).text, /factor \* 7/);
	assert.notEqual(updated.outputs.get(bOutput).text, initial.outputs.get(bOutput).text);
	assert.equal(await readFile(bOutput, "utf8"), initial.outputs.get(bOutput).text, "CLI output must remain stale");

	const addedSource = path.join(fixture.root, "c/src/added.ts");
	const addedOutput = path.join(fixture.root, "c/dist/added.js");
	await writeFile(addedSource, "export const added = 1;\n");
	const created = await session.refresh({ created: [addedSource] });
	assert.equal(created.outputs.has(addedOutput), true);
	await rm(addedSource);
	const deleted = await session.refresh({ deleted: [addedSource] });
	assert.equal(deleted.outputs.has(addedOutput), false);

	const previousTarget = cProject.options.target;
	await writeBaseConfig(fixture.baseConfig, "es2022");
	const reconfigured = await session.refresh({ changed: [fixture.baseConfig] });
	assert.notEqual(
		reconfigured.projects.find(({ configFile }) => configFile === fixture.configs.c).options.target,
		previousTarget,
	);

	await createProject(fixture.root, "d", undefined, "export const d = 1;\n");
	const dConfig = await realpath(path.join(fixture.root, "d/tsconfig.json"));
	const dSource = await realpath(path.join(fixture.root, "d/src/index.ts"));
	const dPackage = await realpath(path.join(fixture.root, "d/package.json"));
	await writeJSON(fixture.configFile, { files: [], references: [{ path: "./a" }, { path: "./d" }] });
	const expanded = await session.refresh({ changed: [fixture.configFile], created: [dConfig, dSource, dPackage] });
	assert.ok(expanded.projects.some(({ configFile }) => configFile === dConfig));
	assert.ok(expanded.outputs.has(path.join(fixture.root, "d/dist/index.js")));
	await writeJSON(fixture.configFile, { files: [], references: [{ path: "./a" }] });
	const contracted = await session.refresh({ changed: [fixture.configFile] });
	assert.equal(
		contracted.projects.some(({ configFile }) => configFile === dConfig),
		false,
	);
	assert.equal(contracted.outputs.has(path.join(fixture.root, "d/dist/index.js")), false);

	await writeFile(fixture.sources.c, dependency(9));
	const generations = await Promise.all([
		session.refresh({ changed: [fixture.sources.c] }),
		session.refresh({ changed: [fixture.sources.c] }),
	]);
	assert.deepEqual(
		generations.map(({ generation }) => generation),
		[contracted.generation + 1, contracted.generation + 2],
	);
	for (const generation of generations) {
		assert.match(generation.outputs.get(bOutput).text, /factor \* 9/);
	}

	await writeFile(fixture.sources.c, dependency(11));
	const inFlight = session.refresh({ changed: [fixture.sources.c] });
	await new Promise((resolve) => setImmediate(resolve));
	await writeFile(fixture.sources.c, dependency(13));
	const latest = session.refresh({ changed: [fixture.sources.c] });
	const concurrentGenerations = await Promise.all([inFlight, latest]);
	assert.match(concurrentGenerations[1].outputs.get(bOutput).text, /factor \* 13/);
	for (const generation of concurrentGenerations) {
		const factor = /factor = (\d+)/.exec(
			generation.outputs.get(path.join(fixture.root, "c/dist/index.js")).text,
		)[1];
		assert.match(generation.outputs.get(bOutput).text, new RegExp(`factor \\* ${factor}\\b`));
	}

	await session.dispose();
	await session.dispose();
	await assert.rejects(session.refresh(), /disposed/);
});

test("reports CLI-equivalent diagnostics, withholds failed outputs, and recovers pending edits", async (context) => {
	const fixture = await createFixture();
	context.after(() => rm(fixture.root, { force: true, recursive: true }));
	const session = await createCompilerSession({ configFile: fixture.configFile, cwd: fixture.root });
	context.after(() => session.dispose());
	const initial = await session.refresh();
	const bOutput = path.join(fixture.root, "b/dist/value.js");

	await writeFile(fixture.sources.c, `${dependency(7)}export const broken: number = "wrong";\n`);
	const cli = spawnSync(process.execPath, [compiler, "--build", fixture.configFile, "--force", "--pretty", "false"], {
		cwd: fixture.root,
		encoding: "utf8",
		timeout: 30_000,
	});
	const cliCodes = diagnosticCodes(cli.stdout + cli.stderr);
	assert.notEqual(cli.status, 0, cli.stdout + cli.stderr);
	assert.ok(cliCodes.includes(2322));

	await assert.rejects(session.refresh({ changed: [fixture.sources.c] }), (error) => {
		assert.equal(error instanceof CompilerSessionError, true);
		assert.deepEqual([...new Set(error.diagnostics.map(({ code }) => code))].sort(), cliCodes);
		assert.match(error.message, /TS2322/);
		assert.equal(error.timing.apiRequestCount > 0, true);
		return true;
	});
	assert.match(initial.outputs.get(bOutput).text, /factor \* 3/);

	await writeFile(fixture.sources.c, dependency(11));
	const repaired = await session.refresh({ changed: [fixture.sources.c] });
	assert.equal(repaired.generation, initial.generation + 1);
	assert.match(repaired.outputs.get(bOutput).text, /factor \* 11/);

	await writeBaseConfig(fixture.baseConfig, "not-a-target");
	await writeFile(fixture.sources.c, dependency(13));
	await assert.rejects(
		session.refresh({ changed: [fixture.baseConfig, fixture.sources.c] }),
		(error) => error instanceof CompilerSessionError && error.diagnostics.some(({ code }) => code === 6046),
	);
	await writeBaseConfig(fixture.baseConfig, "es2022");
	const pendingRecovered = await session.refresh({ changed: [fixture.baseConfig] });
	assert.match(pendingRecovered.outputs.get(bOutput).text, /factor \* 13/);
});

test("checks an intentional noEmit project without requesting emitted files", async (context) => {
	const root = await realpath(await mkdtemp(path.join(tmpdir(), "serve-tools-compiler-no-emit-")));
	context.after(() => rm(root, { force: true, recursive: true }));
	const configFile = path.join(root, "tsconfig.json");
	const sourceFile = path.join(root, "src/index.ts");
	await writeJSON(configFile, {
		compilerOptions: {
			declaration: true,
			module: "esnext",
			noEmit: true,
			strict: true,
			target: "es2022",
			types: [],
		},
		include: ["src"],
	});
	await mkdir(path.dirname(sourceFile), { recursive: true });
	await writeFile(sourceFile, "export const value = 1;\n");
	const session = await createCompilerSession({ configFile, cwd: root });
	context.after(() => session.dispose());

	const generation = await session.refresh();
	assert.equal(generation.projects[0].rootNames.length, 1);
	assert.equal(generation.projects[0].options.noEmit, true);
	assert.equal(generation.outputs.size, 0);

	await writeFile(sourceFile, "export const value = class { private field = 1; };\n");
	await assert.rejects(
		session.refresh({ changed: [sourceFile] }),
		(error) => error instanceof CompilerSessionError && error.diagnostics.some(({ code }) => code === 4094),
	);
});

test("restarts once for stale roots, preserves ordinary sessions, and includes both APIs in timing", async (context) => {
	const fixture = await createFixture();
	context.after(() => rm(fixture.root, { force: true, recursive: true }));
	const instances = [];
	const closed = new Set();
	const timings = new Map();
	let corruptNext = false;
	const updateSnapshot = API.prototype.updateSnapshot;
	const close = API.prototype.close;
	const getTimingInfo = API.prototype.getTimingInfo;
	context.mock.method(API.prototype, "updateSnapshot", async function (params) {
		if (!instances.includes(this)) {
			if (instances.length) {
				assert.ok(closed.has(instances.at(-1)), "close the retired API before replacement");
			}
			instances.push(this);
		}
		const snapshot = await updateSnapshot.call(this, params);
		if (corruptNext) {
			corruptNext = false;
			snapshot.getProject(fixture.configs.c).parsedCommandLine.fileNames = [];
		}
		return snapshot;
	});
	context.mock.method(API.prototype, "close", async function () {
		await close.call(this);
		closed.add(this);
	});
	context.mock.method(API.prototype, "getTimingInfo", async function () {
		const timing = await getTimingInfo.call(this);
		timings.set(this, timing);
		return timing;
	});
	const session = await createCompilerSession({ configFile: fixture.configFile, cwd: fixture.root });
	context.after(() => session.dispose());
	const initial = await session.refresh();
	assert.equal(initial.timing.apiRestartCount, 0);
	await writeFile(fixture.sources.c, dependency(7));
	const updated = await session.refresh({ changed: [fixture.sources.c] });
	assert.equal(updated.timing.apiRestartCount, 0);
	assert.equal(instances.length, 1);
	assert.equal(closed.size, 0);

	const addedSource = path.join(fixture.root, "c/src/added.ts");
	await writeFile(addedSource, "export const added = 1;\n");
	corruptNext = true;
	const recovered = await session.refresh({ created: [addedSource] });
	assert.equal(recovered.generation, updated.generation + 1);
	assert.equal(recovered.timing.apiRestartCount, 1);
	assert.equal(instances.length, 2);
	assert.equal(closed.size, 1);
	assert.ok(
		recovered.projects.find(({ configFile }) => configFile === fixture.configs.c).rootNames.includes(addedSource),
	);
	assert.ok(recovered.outputs.has(path.join(fixture.root, "c/dist/added.js")));
	assert.match(recovered.outputs.get(path.join(fixture.root, "b/dist/value.js")).text, /factor \* 7/);
	for (const [key, value] of Object.entries(recovered.timing.api.totals)) {
		assert.equal(value, timings.get(instances[0]).totals[key] + timings.get(instances[1]).totals[key], key);
	}
	assert.equal(recovered.timing.apiRequestCount, recovered.timing.api.totals.requestCount);
	assert.equal(recovered.timing.api.recentRequests.length, 5);
	assert.equal(
		recovered.timing.configurationMs + recovered.timing.diagnosticsMs + recovered.timing.emitMs,
		recovered.timing.totalMs,
	);

	await writeFile(fixture.sources.c, dependency(9));
	const ordinary = await session.refresh({ changed: [fixture.sources.c] });
	assert.equal(ordinary.timing.apiRestartCount, 0);
	assert.equal(instances.length, 2);
	assert.match(ordinary.outputs.get(path.join(fixture.root, "b/dist/value.js")).text, /factor \* 9/);
	await session.dispose();
	assert.equal(closed.size, 2);
});

test("fails closed after one unsuccessful root recovery and retains the next successful generation", async (context) => {
	const fixture = await createFixture();
	context.after(() => rm(fixture.root, { force: true, recursive: true }));
	let corrupt = false;
	let updates = 0;
	const updateSnapshot = API.prototype.updateSnapshot;
	context.mock.method(API.prototype, "updateSnapshot", async function (params) {
		++updates;
		const snapshot = await updateSnapshot.call(this, params);
		if (corrupt) {
			snapshot.getProject(fixture.configs.c).parsedCommandLine.fileNames = [];
		}
		return snapshot;
	});
	const session = await createCompilerSession({ configFile: fixture.configFile, cwd: fixture.root });
	context.after(() => session.dispose());
	const initial = await session.refresh();
	await writeFile(fixture.sources.c, dependency(11));
	corrupt = true;
	const before = updates;
	await assert.rejects(session.refresh({ changed: [fixture.sources.c] }), (error) => {
		assert.ok(error instanceof CompilerSessionError);
		assert.match(error.message, /inconsistent project roots after restart/);
		assert.equal(error.timing.apiRestartCount, 1);
		assert.ok(error.timing.apiRequestCount > 0);
		assert.equal(error.timing.emitMs, 0);
		return true;
	});
	assert.equal(updates - before, 2);
	assert.match(initial.outputs.get(path.join(fixture.root, "b/dist/value.js")).text, /factor \* 3/);
	corrupt = false;
	const recovered = await session.refresh();
	assert.equal(recovered.generation, initial.generation + 1);
	assert.equal(recovered.timing.apiRestartCount, 0);
	assert.match(recovered.outputs.get(path.join(fixture.root, "b/dist/value.js")).text, /factor \* 11/);
});

async function createFixture() {
	const root = await realpath(await mkdtemp(path.join(tmpdir(), "serve-tools-compiler-session-")));
	const baseConfig = path.join(root, "tsconfig.base.json");
	await writeJSON(path.join(root, "package.json"), { name: "fixture", private: true, type: "module" });
	await writeBaseConfig(baseConfig, "es2020");
	await writeJSON(path.join(root, "tsconfig.json"), { files: [], references: [{ path: "./a" }] });
	await createProject(root, "a", "b", 'import { value } from "@fixture/b/value"; export const result = value + 1;\n');
	await createProject(
		root,
		"b",
		"c",
		'import { factor, Factor } from "@fixture/c"; export const value = factor * Factor.Value;\n',
	);
	await createProject(root, "c", undefined, dependency(3));

	await mkdir(path.join(root, "node_modules/@fixture"), { recursive: true });
	for (const name of ["a", "b", "c"]) {
		await symlink(path.join(root, name), path.join(root, `node_modules/@fixture/${name}`), "dir");
	}

	return {
		root,
		configFile: await realpath(path.join(root, "tsconfig.json")),
		baseConfig: await realpath(baseConfig),
		configs: Object.fromEntries(
			await Promise.all(
				["a", "b", "c"].map(async (name) => [name, await realpath(path.join(root, name, "tsconfig.json"))]),
			),
		),
		sources: Object.fromEntries(
			await Promise.all(
				["a", "b", "c"].map(async (name) => [
					name,
					await realpath(path.join(root, name, `src/${name === "b" ? "value" : "index"}.ts`)),
				]),
			),
		),
	};
}

async function createProject(root, name, reference, source) {
	await writeJSON(path.join(root, `${name}/package.json`), {
		name: `@fixture/${name}`,
		type: "module",
		exports: name === "b" ? { "./value": "./dist/value.js" } : { ".": "./dist/index.js" },
	});
	await writeJSON(path.join(root, `${name}/tsconfig.json`), {
		extends: "../tsconfig.base.json",
		compilerOptions: { rootDir: "src", outDir: "dist" },
		include: ["src"],
		...(reference ? { references: [{ path: `../${reference}` }] } : {}),
	});
	const file = path.join(root, `${name}/src/${name === "b" ? "value" : "index"}.ts`);
	await mkdir(path.dirname(file), { recursive: true });
	await writeFile(file, source);
}

async function writeBaseConfig(file, target) {
	await writeJSON(file, {
		compilerOptions: {
			composite: true,
			declaration: true,
			declarationMap: true,
			inlineSources: true,
			module: "esnext",
			moduleResolution: "bundler",
			sourceMap: true,
			strict: true,
			target,
			types: [],
		},
	});
}

function dependency(value) {
	return `export const enum Factor { Value = ${value} } export const factor: number = ${value};\n`;
}

function diagnosticCodes(output) {
	return [...new Set([...output.matchAll(/error TS(\d+):/g)].map((match) => Number(match[1])))].sort();
}

async function writeJSON(file, value) {
	await mkdir(path.dirname(file), { recursive: true });
	await writeFile(file, `${JSON.stringify(value, null, "\t")}\n`);
}
