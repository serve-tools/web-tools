import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { access, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repositoryRoot = path.dirname(path.dirname(path.dirname(fileURLToPath(import.meta.url))));
const packageRoot = path.join(repositoryRoot, "rolldown/typescript");
const npmCache =
	process.platform === "win32" ? path.join(os.tmpdir(), "web-tools-npm-cache") : "/tmp/web-tools-npm-cache";
const packageName = "@serve-tools/rolldown-typescript";
const compilerVersion = JSON.parse(
	await readFile(new URL("../../node_modules/typescript/package.json", import.meta.url), "utf8"),
).version;

test("the packed package works in external Rolldown and Vite projects", { timeout: 180_000 }, async () => {
	const externalRoot = await mkdtemp(path.join(os.tmpdir(), "serve-tools-rolldown-typescript-distribution-"));
	const artifacts = path.join(externalRoot, "artifacts");
	const rolldownProject = path.join(externalRoot, "projects/rolldown");
	const viteProject = path.join(externalRoot, "projects/vite");

	try {
		await mkdir(artifacts, { recursive: true });
		const tarball = await pack(artifacts);
		await createFixture(externalRoot, rolldownProject, viteProject, tarball);

		await npmInstall(externalRoot);
		await assert.rejects(access(path.join(externalRoot, "node_modules/vite")));
		await run(process.execPath, ["verify-install.mjs"], { cwd: externalRoot });
		await typecheck(externalRoot, "tsconfig.rolldown-types.json");
		await run(process.execPath, ["run.mjs"], { cwd: rolldownProject });

		const repositoryManifest = JSON.parse(await readFile(path.join(repositoryRoot, "package.json"), "utf8"));
		await npmInstall(externalRoot, [`vite@${repositoryManifest.devDependencies.vite}`]);
		await typecheck(externalRoot, "tsconfig.vite-types.json");
		await run(process.execPath, ["run.mjs"], { cwd: viteProject });

		const compilerManifestFile = path.join(externalRoot, "node_modules/typescript/package.json");
		const compilerManifest = await readFile(compilerManifestFile, "utf8");
		const installedCompilerManifest = JSON.parse(compilerManifest);
		const mismatchManifest = {
			...installedCompilerManifest,
			exports: { "./package.json": installedCompilerManifest.exports["./package.json"] },
			version: "0.0.0-mismatch",
		};
		try {
			await writeFile(compilerManifestFile, `${JSON.stringify(mismatchManifest, null, 2)}\n`);
			await run(process.execPath, ["compiler-mismatch.mjs"], { cwd: rolldownProject });
		} finally {
			await writeFile(compilerManifestFile, compilerManifest);
		}

		await assertCompilerOutputsRemainInMemory(rolldownProject);
		await assertCompilerOutputsRemainInMemory(viteProject);
	} finally {
		await rm(externalRoot, { force: true, recursive: true });
	}
});

async function pack(destination) {
	const { stdout } = await runNpm(["pack", "--json", "--pack-destination", destination], {
		cwd: packageRoot,
	});
	const result = JSON.parse(stdout);
	const packed = Array.isArray(result) ? result[0] : Object.values(result)[0];
	assert.equal(packed.name, packageName);
	assert.ok(packed.filename, "npm pack did not report a tarball");
	return path.join(destination, packed.filename);
}

async function npmInstall(cwd, packages = []) {
	await runNpm(["install", "--ignore-scripts", "--no-audit", "--no-fund", "--cache", npmCache, ...packages], {
		cwd,
		timeout: 90_000,
	});
}

async function typecheck(externalRoot, configFile) {
	const compiler = path.join(externalRoot, "node_modules/typescript/bin/tsc");
	await run(process.execPath, [compiler, "--project", configFile], { cwd: externalRoot });
}

async function createFixture(externalRoot, rolldownProject, viteProject, tarball) {
	const repositoryManifest = JSON.parse(await readFile(path.join(repositoryRoot, "package.json"), "utf8"));
	const relativeTarball = `./${path.relative(externalRoot, tarball).split(path.sep).join("/")}`;
	await put(externalRoot, "package.json", {
		private: true,
		type: "module",
		workspaces: ["projects/rolldown/dependency", "projects/vite/dependency"],
		dependencies: {
			[packageName]: `file:${relativeTarball}`,
			"@types/node": repositoryManifest.devDependencies["@types/node"],
			rolldown: repositoryManifest.devDependencies.rolldown,
			typescript: compilerVersion,
		},
	});

	await createProject(rolldownProject, "@distribution/rolldown-dependency", 42);
	await createProject(viteProject, "@distribution/vite-dependency", 84);
	await put(externalRoot, "verify-install.mjs", installVerificationSource());
	await put(externalRoot, "public-rolldown-types.ts", publicTypesSource("rolldown"));
	await put(externalRoot, "public-vite-types.ts", publicTypesSource("vite"));
	const typecheckOptions = {
		compilerOptions: {
			lib: ["ES2023", "DOM"],
			module: "ESNext",
			moduleResolution: "Bundler",
			noEmit: true,
			skipLibCheck: false,
			strict: true,
			target: "ES2022",
			types: ["node"],
		},
	};
	await put(externalRoot, "tsconfig.rolldown-types.json", {
		...typecheckOptions,
		files: ["public-rolldown-types.ts"],
	});
	await put(externalRoot, "tsconfig.vite-types.json", {
		...typecheckOptions,
		files: ["public-vite-types.ts"],
	});
	await put(rolldownProject, "run.mjs", rolldownSource());
	await put(rolldownProject, "compiler-mismatch.mjs", compilerMismatchSource());
	await put(viteProject, "run.mjs", viteSource());
	await put(
		viteProject,
		"index.html",
		'<!doctype html><html><body><script type="module" src="/src/main.js"></script></body></html>\n',
	);
}

async function createProject(root, dependencyName, answer) {
	await put(root, "tsconfig.json", { files: [], references: [{ path: "./dependency" }] });
	await put(root, "src/main.js", `export { answer } from "${dependencyName}";\n`);
	await put(root, "dependency/package.json", {
		name: dependencyName,
		private: true,
		type: "module",
		sideEffects: false,
		exports: { ".": "./dist/index.js" },
	});
	await put(root, "dependency/tsconfig.json", {
		compilerOptions: {
			composite: true,
			declaration: true,
			module: "ESNext",
			moduleResolution: "Bundler",
			outDir: "dist",
			rootDir: "src",
			sourceMap: true,
			strict: true,
			target: "ES2022",
			types: [],
		},
		include: ["src"],
	});
	await put(root, "dependency/src/index.ts", `export const answer: number = ${answer};\n`);
}

async function put(root, name, contents) {
	const file = path.join(root, name);
	await mkdir(path.dirname(file), { recursive: true });
	await writeFile(file, typeof contents === "string" ? contents : `${JSON.stringify(contents, null, 2)}\n`);
}

function installVerificationSource() {
	return `import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFile } from "node:fs/promises";

const packageName = ${JSON.stringify(packageName)};
const expectedCompiler = ${JSON.stringify(compilerVersion)};
const require = createRequire(import.meta.url);
const entry = import.meta.resolve(packageName);
assert.match(entry, /node_modules\\/${packageName.replace("/", "\\/")}\\/dist\\/rolldown-typescript\\.js$/);
const { typescript } = await import(packageName);
assert.equal(typeof typescript, "function");
const manifest = JSON.parse(await readFile(new URL("./node_modules/@serve-tools/rolldown-typescript/package.json", import.meta.url), "utf8"));
assert.equal(manifest.exports["."], "./dist/rolldown-typescript.js");
assert.equal(manifest.peerDependencies.typescript, "~7.1.0-0");
assert.equal(manifest.peerDependencies.rolldown, "^1.2.7");
assert.equal(manifest.peerDependencies.vite, "^8.2.2");
assert.equal(manifest.peerDependenciesMeta.rolldown.optional, true);
assert.equal(manifest.peerDependenciesMeta.vite.optional, true);
for (const dependency of Object.keys(manifest.dependencies ?? {})) {
	require.resolve(dependency);
}
assert.equal(JSON.parse(await readFile(new URL("./node_modules/typescript/package.json", import.meta.url), "utf8")).version, expectedCompiler);
`;
}

function publicTypesSource(host) {
	const pluginType = host === "rolldown" ? "RolldownPlugin" : "VitePlugin";
	return `import { typescript } from "${packageName}";
import type { Plugin as ${pluginType} } from "${host}";

const plugin = typescript({
	conditions: ["browser"],
	configFile: "tsconfig.json",
	cwd: ".",
});
const hostPlugin: ${pluginType} = plugin;
void hostPlugin;
await plugin.api.dispose();
`;
}

function rolldownSource() {
	return `import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { rolldown } from "rolldown";
import { typescript } from "${packageName}";

assert.equal(existsSync("dependency/dist"), false);
let build;
let plugin;
try {
	plugin = typescript({ configFile: "tsconfig.json", cwd: process.cwd() });
	build = await rolldown({ input: "src/main.js", plugins: [plugin] });
	const { output } = await build.generate({ format: "es", sourcemap: true });
	const chunk = output.find((item) => item.type === "chunk");
	assert.ok(chunk);
	assert.ok(chunk.map);
	assert.ok(chunk.map.sources.some((source) => source.endsWith("/dependency/src/index.ts")), chunk.map.sources.join("\\n"));
	assert.equal((await import(\`data:text/javascript;base64,\${Buffer.from(chunk.code).toString("base64")}\`)).answer, 42);
} finally {
	await build?.close();
	await plugin?.api.dispose();
}
assert.equal(existsSync("dependency/dist"), false);
`;
}

function viteSource() {
	return `import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { createServer, build as viteBuild } from "vite";
import { typescript } from "${packageName}";

assert.equal(existsSync("dependency/dist"), false);
let buildPlugin;
try {
	buildPlugin = typescript({ configFile: "tsconfig.json", cwd: process.cwd() });
	await viteBuild({
		root: process.cwd(),
		configFile: false,
		logLevel: "silent",
		plugins: [buildPlugin],
		build: {
			emptyOutDir: true,
			lib: { entry: "src/main.js", fileName: "bundle", formats: ["es"] },
			outDir: "build",
			sourcemap: true,
		},
	});
	assert.equal((await import(new URL("./build/bundle.js", import.meta.url))).answer, 84);
	const map = JSON.parse(await readFile("build/bundle.js.map", "utf8"));
	assert.ok(map.sources.some((source) => source.endsWith("/dependency/src/index.ts")), map.sources.join("\\n"));
} finally {
	await buildPlugin?.api.dispose();
}

let devPlugin;
let server;
try {
	devPlugin = typescript({ configFile: "tsconfig.json", cwd: process.cwd() });
	server = await createServer({
		root: process.cwd(),
		configFile: false,
		clearScreen: false,
		logLevel: "silent",
		plugins: [devPlugin],
		optimizeDeps: { noDiscovery: true },
		server: { host: "127.0.0.1", port: 0 },
	});
	await server.listen();
	const address = server.httpServer.address();
	assert.ok(address && typeof address === "object");
	assert.equal((await fetch(\`http://127.0.0.1:\${address.port}/\`)).status, 200);
	assert.equal((await server.ssrLoadModule("/src/main.js")).answer, 84);
} finally {
	await server?.close();
	await devPlugin?.api.dispose();
}
assert.equal(existsSync("dependency/dist"), false);
`;
}

function compilerMismatchSource() {
	return `import assert from "node:assert/strict";
import { typescript } from "${packageName}";

const plugin = typescript({ configFile: "tsconfig.json", cwd: process.cwd() });
await assert.rejects(
	plugin.config({}),
	(error) => {
		assert.match(error.message, /requires TypeScript ~7\\.1\\.0-0/);
		assert.match(error.message, /found 0\\.0\\.0-mismatch/);
		return true;
	},
);
`;
}

async function assertCompilerOutputsRemainInMemory(root) {
	await assert.rejects(access(path.join(root, "dependency/dist")));
	await assert.rejects(access(path.join(root, "dependency/tsconfig.tsbuildinfo")));
}

function run(command, arguments_, { cwd, timeout = 30_000 } = {}) {
	return new Promise((resolve, reject) => {
		execFile(
			command,
			arguments_,
			{
				cwd,
				encoding: "utf8",
				env: { ...process.env, NO_COLOR: "1" },
				maxBuffer: 10 * 1024 * 1024,
				timeout,
			},
			(error, stdout, stderr) => {
				if (error) {
					error.message += `\n${stdout}${stderr}`;
					reject(error);
					return;
				}

				resolve({ stderr, stdout });
			},
		);
	});
}

function runNpm(arguments_, options) {
	const npm = process.env.npm_execpath;
	if (!npm) {
		throw new Error("npm_execpath is unavailable; run this test through its npm script");
	}
	return run(process.execPath, [npm, ...arguments_], options);
}
