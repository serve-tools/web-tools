import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, realpath, rm, symlink, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { parseArgs } from "node:util";
import { rolldown } from "rolldown";

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
	const { values } = parseArgs({
		options: {
			compiler: { type: "string" },
			native: { type: "string" },
			"require-adapter": { type: "boolean", default: false },
			help: { type: "boolean", default: false },
		},
	});

	if (values.help) {
		console.log(
			"Usage: node scripts/typescript-migration/probe.mjs [--compiler package-directory] [--native executable] [--require-adapter]",
		);
	} else {
		const report = await runCompilerProbe(values);
		console.log(JSON.stringify(report, null, 2));
		if (report.checks.some(({ status }) => status === "failed")) {
			process.exitCode = 1;
		}
	}
}

/** Exercise one installed compiler entirely inside a disposable fixture. */
export async function runCompilerProbe(values = {}) {
	const compiler = await realpath(
		values.compiler ?? fileURLToPath(new URL("../../node_modules/typescript", import.meta.url)),
	);
	const manifest = JSON.parse(await readFile(path.join(compiler, "package.json"), "utf8"));
	assert.equal(manifest.name, "typescript", "--compiler must identify the typescript package directory");
	const requireCompiler = createRequire(path.join(compiler, "package.json"));
	const native = values.native && (await realpath(values.native));
	const root = await realpath(await mkdtemp(path.join(tmpdir(), "web-tools-ts-probe-")));
	const report = {
		compiler: manifest.version,
		rolldown: createRequire(import.meta.url)("rolldown/package.json").version,
		node: process.version,
		platform: process.platform,
		arch: process.arch,
		probeSha256: createHash("sha256")
			.update(await readFile(fileURLToPath(import.meta.url)))
			.digest("hex"),
		checks: [],
	};
	let stage = "compiler-version";
	const cli = (args) => {
		const result = spawnSync(
			native ?? process.execPath,
			native ? args : [path.join(compiler, "bin/tsc"), ...args],
			{
				cwd: root,
				encoding: "utf8",
				timeout: 30_000,
			},
		);
		if (result.error) {
			throw result.error;
		}
		assert.equal(result.signal, null, `Compiler terminated: ${result.signal}`);
		return result;
	};
	const pass = (name, detail = {}) => report.checks.push({ name, status: "passed", ...detail });
	const put = async (name, contents) => {
		const target = path.join(root, name);
		await mkdir(path.dirname(target), { recursive: true });
		await writeFile(target, typeof contents === "string" ? contents : JSON.stringify(contents));
	};
	const options = {
		composite: true,
		declaration: true,
		sourceMap: true,
		rootDir: "src",
		outDir: "dist",
		module: "esnext",
		moduleResolution: "bundler",
		target: "es2022",
		types: [],
		strict: true,
	};
	const apis = {};
	try {
		const version = cli(["--version"]);
		assert.equal(version.status, 0, version.stderr);
		assert.equal(
			version.stdout.trim(),
			`Version ${manifest.version}`,
			"Compiler client and executable versions differ",
		);
		pass(stage);
		for (const mode of ["async", "sync"]) {
			apis[mode] = (await import(pathToFileURL(requireCompiler.resolve(`typescript/unstable/${mode}`)).href)).API;
		}

		const cases = [
			["valid", "export const result: number = 1;", {}, []],
			["semantic-error", "export const result: number = 'wrong';", {}, [2322]],
			["syntax-error", "export const result = ;", {}, [1109]],
			["declaration-error", "export const result = class { private value = 1; };", {}, [4094]],
			["config-error", "export const result = 1;", { notACompilerOption: true }, [5023]],
		];
		for (const [name, source, extra, expected] of cases) {
			await put("checks/src/index.ts", source);
			await put("checks/tsconfig.json", {
				compilerOptions: { ...options, noEmit: true, ...extra },
				include: ["src"],
			});
			const config = path.join(root, "checks/tsconfig.json");
			const command = cli(["--project", config, "--pretty", "false"]);
			const cliCodes = [
				...new Set([...command.stdout.matchAll(/error TS(\d+):/g)].map((match) => Number(match[1]))),
			].sort();
			assert.deepEqual(
				cliCodes,
				expected,
				`${name}: unexpected CLI diagnostics\n${command.stdout}${command.stderr}`,
			);
			assert.equal(command.status === 0, expected.length === 0, `${name}: incorrect CLI status`);
			for (const mode of ["async", "sync"]) {
				stage = `${mode}/${name}`;
				const api = new apis[mode]({ cwd: root, ...(native ? { tsserverPath: native } : {}) });
				let snapshot;
				try {
					const parsed = await api.parseConfigFile(config);
					assert.ok(
						parsed.fileNames.some(
							(file) => path.normalize(file) === path.join(root, "checks/src/index.ts"),
						),
					);
					snapshot = await api.updateSnapshot({ openProjects: [config] });
					const project = snapshot.getProject(config);
					assert.ok(project, "Configured project did not open");
					assert.deepEqual(
						await diagnosticCodes(project.program),
						cliCodes,
						`${stage}: API/CLI disagreement`,
					);
					pass(stage, { diagnosticCodes: cliCodes });
				} finally {
					try {
						await snapshot?.dispose();
					} finally {
						await api.close();
					}
				}
			}
		}

		stage = "referenced-fixture";
		await put("tsconfig.json", { files: [], references: [{ path: "./a" }] });
		for (const name of ["a", "b", "c"]) {
			const next = { a: "b", b: "c" }[name];
			await put(`${name}/package.json`, {
				name: `@fixture/${name}`,
				type: "module",
				exports: name === "b" ? { "./value": "./dist/value.js" } : { ".": "./dist/index.js" },
			});
			await put(`${name}/tsconfig.json`, {
				compilerOptions: options,
				include: ["src"],
				...(next ? { references: [{ path: `../${next}` }] } : {}),
			});
			await mkdir(path.join(root, "node_modules/@fixture"), { recursive: true });
			await symlink(
				path.join(root, name),
				path.join(root, `node_modules/@fixture/${name}`),
				process.platform === "win32" ? "junction" : "dir",
			);
		}
		await put("a/src/index.ts", 'import { value } from "@fixture/b/value"; export const result = value + 1;');
		await put(
			"b/src/value.ts",
			'import { factor, Factor } from "@fixture/c"; export const value = factor * Factor.Value;',
		);
		const dependency = (value) =>
			`export const enum Factor { Value = ${value} } export const factor: number = ${value};`;
		await put("c/src/index.ts", dependency(3));
		const api = new apis.async({ cwd: root, ...(native ? { tsserverPath: native } : {}) });
		let snapshot;
		try {
			snapshot = await api.updateSnapshot({ openProjects: [path.join(root, "a/tsconfig.json")] });
			const program = snapshot.getProject(path.join(root, "a/tsconfig.json")).program;
			if (typeof program.emitToString !== "function") {
				report.checks.push({
					name: "adapter",
					status: "unsupported",
					reason: "Program.emitToString is unavailable",
				});
				assert.ok(!values["require-adapter"], "Selected compiler does not support the required adapter probe");
			} else {
				const configs = [];
				const visit = async (config) => {
					config = path.normalize(config);
					if (configs.includes(config)) {
						return;
					}
					configs.push(config);
					const parsed = await api.parseConfigFile(config);
					assert.deepEqual(parsed.errors, [], `Invalid config: ${config}`);
					for (const reference of parsed.projectReferences ?? []) {
						await visit(
							reference.path.endsWith(".json")
								? reference.path
								: path.join(reference.path, "tsconfig.json"),
						);
					}
				};
				await visit(path.join(root, "tsconfig.json"));
				assert.equal(configs.length, 4, "Root references must discover A → B → C");
				const projectConfigs = configs.filter((config) => config !== path.join(root, "tsconfig.json"));
				const exports = new Map();
				for (const config of projectConfigs) {
					const directory = path.dirname(config);
					const pkg = JSON.parse(await readFile(path.join(directory, "package.json"), "utf8"));
					for (const [subpath, target] of Object.entries(pkg.exports)) {
						exports.set(pkg.name + (subpath === "." ? "" : subpath.slice(1)), path.join(directory, target));
					}
				}
				await snapshot.dispose();
				snapshot = await api.updateSnapshot({ openProjects: projectConfigs });
				const emit = async () => {
					const files = new Map();
					for (const config of projectConfigs) {
						const current = snapshot.getProject(config).program;
						assert.deepEqual(await diagnosticCodes(current), [], config);
						const result = await current.emitToString();
						assert.equal(result.emitSkipped, false);
						assert.deepEqual(result.diagnostics, []);
						for (const [file, output] of result.outputFiles) {
							if (file.endsWith(".js") || file.endsWith(".d.ts")) {
								assert.ok(output.sourceFileName, `Missing source association for ${file}`);
							}
							files.set(path.normalize(file), output.text);
						}
					}
					return files;
				};
				const update = async (fileChanges) => {
					const previous = snapshot;
					snapshot = await api.updateSnapshot({
						fileChanges: Object.fromEntries(
							Object.entries(fileChanges).map(([kind, files]) => [
								kind,
								files.map((file) => ({ uri: pathToFileURL(file).href })),
							]),
						),
					});
					await previous.dispose();
				};
				stage = "clean-memory-bundle";
				const initial = await emit();
				const expectedFiles = [...exports.values()].flatMap((file) => [
					file,
					`${file}.map`,
					file.replace(/\.js$/, ".d.ts"),
				]);
				assert.deepEqual(
					[...initial.keys()].sort(),
					expectedFiles.sort(),
					"Emit must include every JavaScript, declaration, and source-map artifact",
				);
				for (const name of ["a", "b", "c"]) {
					assert.equal(existsSync(path.join(root, name, "dist")), false);
				}
				assert.equal(await bundleResult(exports.get("@fixture/a"), initial, exports), 10);
				for (const [name, contents] of initial) {
					if (name.endsWith(".js.map")) {
						assert.ok(JSON.parse(contents).sources.length > 0);
					}
				}
				pass(stage, { result: 10, outputCount: initial.size });

				stage = "disk-memory-parity";
				const built = cli(["--build", path.join(root, "tsconfig.json"), "--pretty", "false"]);
				assert.equal(built.status, 0, built.stdout + built.stderr);
				for (const [name, contents] of initial) {
					assert.equal(await readFile(name, "utf8"), contents, name);
				}
				assert.equal(await bundleResult(exports.get("@fixture/a")), 10);
				pass(stage);

				stage = "transitive-edit-with-stale-dist";
				const changed = path.join(root, "c/src/index.ts");
				await put("c/src/index.ts", dependency(7));
				await update({ changed: [changed] });
				const updated = await emit();
				assert.equal(await bundleResult(exports.get("@fixture/a"), updated, exports), 50);
				assert.equal(
					await bundleResult(exports.get("@fixture/a")),
					10,
					"Physical dist must remain stale during this check",
				);
				assert.notEqual(
					updated.get(exports.get("@fixture/b/value")),
					initial.get(exports.get("@fixture/b/value")),
					"Unedited consumer must re-emit its inlined const enum",
				);
				pass(stage, { memoryResult: 50, diskResult: 10 });

				stage = "edit-error-recovery";
				await put("c/src/index.ts", dependency(7) + ' export const broken: number = "wrong";');
				await update({ changed: [changed] });
				assert.ok(
					(await diagnosticCodes(snapshot.getProject(path.join(root, "c/tsconfig.json")).program)).includes(
						2322,
					),
				);
				await put("c/src/index.ts", dependency(9));
				await update({ changed: [changed] });
				assert.equal(await bundleResult(exports.get("@fixture/a"), await emit(), exports), 82);
				pass(stage, { result: 82 });

				stage = "file-create-delete";
				const added = path.join(root, "c/src/added.ts");
				const addedOutput = path.join(root, "c/dist/added.js");
				await put("c/src/added.ts", "export const added = 1;");
				await update({ created: [added] });
				assert.ok((await emit()).has(addedOutput), "New included source must emit");
				await rm(added);
				await update({ deleted: [added] });
				assert.equal((await emit()).has(addedOutput), false, "Deleted source must leave the output set");
				pass(stage);
			}
		} finally {
			try {
				await snapshot?.dispose();
			} finally {
				await api.close();
			}
		}
		pass("session-disposal");
	} catch (error) {
		report.checks.push({ name: stage, status: "failed", message: error.message });
	} finally {
		try {
			await rm(root, { recursive: true, force: true });
			pass("fixture-cleanup");
		} catch (error) {
			report.checks.push({ name: "fixture-cleanup", status: "failed", message: error.message });
		}
	}
	return report;
}

async function diagnosticCodes(program) {
	const diagnostics = [];
	for (const method of [
		"getConfigFileParsingDiagnostics",
		"getSyntacticDiagnostics",
		"getProgramDiagnostics",
		"getBindDiagnostics",
		"getGlobalDiagnostics",
		"getSemanticDiagnostics",
		"getDeclarationDiagnostics",
	]) {
		diagnostics.push(...(await program[method]()));
	}
	return [...new Set(diagnostics.map(({ code }) => code))].sort();
}

async function bundleResult(input, files, exports) {
	const build = await rolldown({
		input,
		plugins: files
			? [
					{
						name: "migration-fixture-outputs",
						resolveId(id, importer) {
							const normalized = path.normalize(id);
							if (files.has(normalized)) {
								return normalized;
							}
							if (exports.has(id)) {
								return exports.get(id);
							}
							if (id.startsWith("@fixture/")) {
								throw new Error(`Fixture import is not public: ${id}`);
							}
							const resolved = importer && path.resolve(path.dirname(importer), id);
							if (resolved && files.has(resolved)) {
								return resolved;
							}
						},
						load(id) {
							return files.get(path.normalize(id));
						},
					},
				]
			: [],
	});
	try {
		const { output } = await build.generate({ format: "es" });
		assert.equal(output.length, 1, "Fixture must produce one executable chunk");
		assert.equal(output[0].type, "chunk");
		const url = `data:text/javascript;base64,${Buffer.from(output[0].code).toString("base64")}`;
		return (await import(url)).result;
	} finally {
		await build.close();
	}
}
