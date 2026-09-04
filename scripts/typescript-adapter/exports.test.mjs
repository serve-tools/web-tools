import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { canonicalPath, hasSideEffects, readProjectPackages, resolveProjectExport } from "./exports.mjs";

test("public exports preserve condition order, patterns, null boundaries, and side effects", async () => {
	const root = await mkdtemp(path.join(os.tmpdir(), "ts-adapter-exports-"));
	try {
		const manifest = {
			name: "@fixture/pkg",
			exports: {
				".": { types: "./dist/index.d.ts", browser: "./dist/browser.js", import: "./dist/index.js" },
				"./features/*": "./dist/features/*.js",
				"./features/private/*": null,
				"./features/special": ["../invalid", "./dist/special.js"],
				"./blocked": { browser: null, default: "./dist/index.js" },
			},
			sideEffects: ["./dist/features/*.js"],
		};
		await writeFile(path.join(root, "package.json"), JSON.stringify(manifest));
		const packages = await readProjectPackages([{ configFile: path.join(root, "tsconfig.json") }]);
		const conditions = new Set(["browser", "import"]);
		const resolved = await resolveProjectExport(packages, "@fixture/pkg", conditions);
		assert.equal(resolved.id, path.join(await canonicalPath(root), "dist/browser.js"));
		assert.equal(resolved.moduleSideEffects, false);
		assert.equal(
			(await resolveProjectExport(packages, "@fixture/pkg/features/a", conditions)).moduleSideEffects,
			true,
		);
		assert.match(
			(await resolveProjectExport(packages, "@fixture/pkg/features/special", conditions)).id,
			/special\.js$/,
		);
		await assert.rejects(
			resolveProjectExport(packages, "@fixture/pkg/features/private/a", conditions),
			/not exported/,
		);
		await assert.rejects(resolveProjectExport(packages, "@fixture/pkg/blocked", conditions), /not exported/);
		await assert.rejects(resolveProjectExport(packages, "@fixture/pkg/private", conditions), /not exported/);
		await assert.rejects(
			resolveProjectExport(packages, "@fixture/pkg/features/../secret", conditions),
			/Invalid export/,
		);
		assert.equal(await resolveProjectExport(packages, "unrelated", conditions), null);
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});

test("missing output directories and symlinks use one canonical identity", async () => {
	const root = await mkdtemp(path.join(os.tmpdir(), "ts-adapter-path-"));
	try {
		await mkdir(path.join(root, "actual"));
		await symlink(
			path.join(root, "actual"),
			path.join(root, "alias"),
			process.platform === "win32" ? "junction" : "dir",
		);
		assert.equal(
			await canonicalPath(path.join(root, "alias/dist/file.js")),
			await canonicalPath(path.join(root, "actual/dist/file.js")),
		);
		assert.equal(hasSideEffects(["*.js"], "dist/file.js"), true);
		assert.equal(hasSideEffects(false, "dist/file.js"), false);
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});
