import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { readTypeScriptMigrationInventory } from "./inventory.mjs";

test("collects deterministic compiler, demo, consumer, and project-reference migration facts", async () => {
	const root = await createRepository();

	try {
		const inventory = await readTypeScriptMigrationInventory(root);

		assert.equal(inventory.root.path, root);
		assert.equal(inventory.root.packageManager, "npm@11.5.1");
		assert.deepEqual(inventory.compilerPins, [
			{ location: "package.json", name: "example", section: "devDependencies", version: "7.1.0-dev.20260904.1" },
			{
				location: "packages/demo/package.json",
				name: "@example/demo",
				section: "devDependencies",
				version: "7.1.0-dev.20260904.1",
			},
			{
				location: "packages/fixture/package.json",
				name: "@example/fixture",
				section: "dependencies",
				version: "5.9.3",
			},
		]);
		assert.deepEqual(inventory.compilerApiConsumerCandidates, [
			"scripts/compiler.mjs",
			"scripts/dynamic-import.mjs",
			"scripts/import-meta-resolve.mjs",
			"scripts/require-resolve.mjs",
			"scripts/require.mjs",
		]);
		assert.deepEqual(inventory.demos, [
			{
				location: "packages/demo",
				name: "@example/demo",
				buildBundle: "vite build",
				buildDependencies: "npm run build --workspace @example/library",
			},
		]);
		assert.deepEqual(inventory.buildDependencyScripts, [
			{ location: "packages/demo", name: "@example/demo", script: "npm run build --workspace @example/library" },
			{
				location: "packages/fixture",
				name: "@example/fixture",
				script: "npm run build --workspace @example/library",
			},
		]);
		assert.deepEqual(inventory.projectReferences, {
			root: { config: "tsconfig.build.json", references: ["packages/library/tsconfig.json"] },
			workspaces: [
				{
					location: "packages/demo",
					configs: [
						{ config: "packages/demo/tsconfig.json", references: ["packages/library/tsconfig.json"] },
					],
				},
				{ location: "packages/fixture", configs: [] },
				{
					location: "packages/library",
					configs: [{ config: "packages/library/tsconfig.json", references: [] }],
				},
			],
		});
		assert.deepEqual(inventory.olderCompilerPins, [
			{
				location: "packages/fixture/package.json",
				name: "@example/fixture",
				section: "dependencies",
				version: "5.9.3",
			},
		]);
	} finally {
		await rm(root, { force: true, recursive: true });
	}
});

test("preserves compiler ranges and identifies the older fixture", async () => {
	const root = await createRepository();
	const range = "7.1.0-0 - 7.1.0";

	try {
		for (const location of ["package.json", "packages/demo/package.json"]) {
			const file = path.join(root, location);
			const manifest = JSON.parse(await readFile(file, "utf8"));
			manifest.devDependencies.typescript = range;
			await writeJSON(file, manifest);
		}

		const inventory = await readTypeScriptMigrationInventory(root);
		const versions = inventory.compilerPins.map(({ version }) => version);
		const olderVersions = inventory.olderCompilerPins.map(({ version }) => version);

		assert.deepEqual(versions, [range, range, "5.9.3"]);
		assert.deepEqual(olderVersions, ["5.9.3"]);
	} finally {
		await rm(root, { force: true, recursive: true });
	}
});

test("rejects missing and unknown command-line arguments", () => {
	for (const arguments_ of [["--root"], ["--root", "--unknown"], ["--unknown"], ["--root", "one", "--root", "two"]]) {
		const result = spawnSync(
			process.execPath,
			[fileURLToPath(new URL("./inventory.mjs", import.meta.url)), ...arguments_],
			{
				encoding: "utf8",
			},
		);

		assert.equal(result.status, 1);
		assert.match(
			result.stderr,
			/Missing value for --root|Unknown argument: --unknown|--root may only be provided once/,
		);
	}
});

async function createRepository() {
	const root = await mkdtemp(path.join(os.tmpdir(), "serve-tools-typescript-migration-"));

	await writeJSON(path.join(root, "package.json"), {
		name: "example",
		packageManager: "npm@11.5.1",
		workspaces: ["packages/library", "packages/demo", "packages/fixture"],
		devDependencies: { typescript: "7.1.0-dev.20260904.1" },
	});
	await writeJSON(path.join(root, "tsconfig.build.json"), {
		references: [{ path: "./packages/library/tsconfig.json" }],
	});
	await writeJSON(path.join(root, "packages/library/package.json"), { name: "@example/library" });
	await writeJSON(path.join(root, "packages/library/tsconfig.json"), {});
	await writeJSON(path.join(root, "packages/demo/package.json"), {
		name: "@example/demo",
		devDependencies: { typescript: "7.1.0-dev.20260904.1" },
		scripts: { "build:bundle": "vite build", "build:dependencies": "npm run build --workspace @example/library" },
	});
	await writeJSON(path.join(root, "packages/demo/tsconfig.json"), {
		references: [{ path: "../library/tsconfig.json" }],
	});
	await writeJSON(path.join(root, "packages/fixture/package.json"), {
		name: "@example/fixture",
		dependencies: { typescript: "5.9.3" },
		scripts: { "build:dependencies": "npm run build --workspace @example/library" },
	});
	await writeText(path.join(root, "scripts/compiler.mjs"), 'import { API } from "typescript/unstable/async";\n');
	await writeText(path.join(root, "scripts/dynamic-import.mjs"), 'await import("typescript/unstable/sync");\n');
	await writeText(path.join(root, "scripts/import-meta-resolve.mjs"), 'import.meta.resolve("typescript");\n');
	await writeText(path.join(root, "scripts/not-a-consumer.mjs"), 'const name = "typescript";\n');
	await writeText(path.join(root, "scripts/require-resolve.mjs"), 'require.resolve("typescript/unstable/sync");\n');
	await writeText(path.join(root, "scripts/require.mjs"), 'require("typescript");\n');

	return root;
}

async function writeJSON(file, value) {
	await writeText(file, `${JSON.stringify(value, null, "\t")}\n`);
}

async function writeText(file, value) {
	await mkdir(path.dirname(file), { recursive: true });
	await writeFile(file, value);
}
