import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, realpath, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

const compilerOptions = {
	composite: true,
	declaration: true,
	experimentalDecorators: true,
	module: "esnext",
	moduleResolution: "bundler",
	outDir: "dist",
	rootDir: "src",
	sourceMap: true,
	strict: true,
	target: "es2022",
	types: [],
};

/** Create the referenced A → B → C browser fixture without compiler output directories. */
export async function createBrowserFixture() {
	const root = await realpath(await mkdtemp(path.join(tmpdir(), "web-tools-ts-adapter-browser-")));
	const put = async (name, contents) => {
		const target = path.join(root, name);
		await mkdir(path.dirname(target), { recursive: true });
		await writeFile(target, typeof contents === "string" ? contents : JSON.stringify(contents));
		return target;
	};

	await put("package.json", { private: true, type: "module" });
	await put("tsconfig.json", { files: [], references: [{ path: "./a" }] });
	for (const name of ["a", "b", "c"]) {
		const reference = { a: "b", b: "c" }[name];
		await put(`${name}/package.json`, {
			name: `@fixture/${name}`,
			private: true,
			sideEffects: false,
			type: "module",
			exports: name === "b" ? { "./value": "./dist/value.js" } : { ".": "./dist/index.js" },
		});
		await put(`${name}/tsconfig.json`, {
			compilerOptions,
			include: ["src"],
			...(reference ? { references: [{ path: `../${reference}` }] } : {}),
		});
		await mkdir(path.join(root, "node_modules/@fixture"), { recursive: true });
		await symlink(
			path.join(root, name),
			path.join(root, `node_modules/@fixture/${name}`),
			process.platform === "win32" ? "junction" : "dir",
		);
	}

	const importerSource = (addend) =>
		[
			'import { decoratorResult, mappedFailure, value } from "@fixture/b/value";',
			`export const result = value + ${addend};`,
			"export { decoratorResult, mappedFailure };",
			"",
		].join("\n");
	const importer = await put("a/src/index.ts", importerSource(1));
	await put(
		"b/src/value.ts",
		[
			'import { decoratorResult, factor, Factor, mappedFailure } from "@fixture/c";',
			"export const value = factor * Factor.Value;",
			"export { decoratorResult, mappedFailure };",
			"",
		].join("\n"),
	);

	const dependencySource = (value, error = false) =>
		[
			"function stamped(target: { stamp?: string }) {",
			'\ttarget.stamp = "decorated";',
			"}",
			"",
			"@stamped",
			"class Decorated {",
			"\tstatic stamp?: string;",
			"}",
			"",
			"export const decoratorResult = Decorated.stamp;",
			`export const enum Factor { Value = ${value} }`,
			`export const factor: number = ${value};`,
			"export function mappedFailure() {",
			'\tthrow new Error("mapped failure");',
			"}",
			...(error ? ["", 'export const broken: number = "wrong";'] : []),
			"",
		].join("\n");
	const dependency = await put("c/src/index.ts", dependencySource(3));
	const initialDependencySource = await readFile(dependency, "utf8");
	const mappedLine = initialDependencySource
		.slice(0, initialDependencySource.indexOf("throw new Error"))
		.split("\n").length;

	await put("generated/asset.js", ['export const asset = "prepared asset";', ""].join("\n"));
	await put(
		"index.html",
		[
			"<!doctype html>",
			'<html><body><output id="result"></output><script type="module" src="/src/main.js"></script></body></html>',
			"",
		].join("\n"),
	);
	await put(
		"src/main.js",
		[
			'import { decoratorResult, mappedFailure, result } from "@fixture/a";',
			'import { asset } from "/generated/asset.js";',
			"",
			"let generation = 0;",
			"window.__typescriptAdapterHistory = [];",
			"function publish(module) {",
			"\t++generation;",
			"\twindow.__typescriptAdapter = {",
			"\t\tasset,",
			"\t\tdecorator: module.decoratorResult,",
			"\t\tgeneration,",
			"\t\tresult: module.result,",
			"\t};",
			"\twindow.__typescriptAdapterHistory.push(window.__typescriptAdapter);",
			"\twindow.__mappedFailure = module.mappedFailure;",
			'\tdocument.querySelector("#result").textContent = String(module.result);',
			"}",
			"",
			"publish({ decoratorResult, mappedFailure, result });",
			"",
			"if (import.meta.hot) {",
			'\timport.meta.hot.accept("@fixture/a", (module) => publish(module));',
			"}",
			"",
		].join("\n"),
	);

	return {
		configFile: path.join(root, "tsconfig.json"),
		dependency,
		importer,
		mappedLine,
		root,
		async assertNoDist() {
			for (const name of ["a", "b", "c"]) {
				if (existsSync(path.join(root, name, "dist"))) {
					throw new Error(`${name}/dist unexpectedly exists`);
				}
			}
		},
		async dispose() {
			await rm(root, { force: true, recursive: true });
		},
		async writeCompilerError() {
			await writeFile(dependency, dependencySource(7, true));
		},
		async writeDependency(value) {
			await writeFile(dependency, dependencySource(value));
		},
		async writeImporter(addend) {
			await writeFile(importer, importerSource(addend));
		},
		async writeStaleDist() {
			await put(
				"a/dist/index.js",
				[
					"export const result = -100;",
					'export const decoratorResult = "stale";',
					"export function mappedFailure() {}",
					"",
				].join("\n"),
			);
			await put(
				"b/dist/value.js",
				[
					"export const value = -101;",
					'export const decoratorResult = "stale";',
					"export function mappedFailure() {}",
					"",
				].join("\n"),
			);
			await put(
				"c/dist/index.js",
				[
					"export const factor = -1;",
					'export const decoratorResult = "stale";',
					"export function mappedFailure() {}",
					"",
				].join("\n"),
			);
		},
	};
}
