import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { readWorkspaceInventory } from "./workspaces.mjs";

test("reads a deterministic public and private workspace inventory", async () => {
	const root = await createRepository({
		workspaces: ["packages/public", "packages/private"],
		manifests: {
			"packages/private": { name: "@example/private", private: true },
			"packages/public": { name: "@example/public", version: "1.0.0" },
		},
	});

	try {
		const inventory = await readWorkspaceInventory(root);

		assert.deepEqual(
			inventory.workspaces.map(({ location }) => location),
			["packages/private", "packages/public"],
		);
		assert.deepEqual(
			inventory.publicWorkspaces.map(({ name }) => name),
			["@example/public"],
		);
		assert.deepEqual(
			inventory.privateWorkspaces.map(({ name }) => name),
			["@example/private"],
		);
		assert.equal(inventory.workspacesByName.get("@example/public"), inventory.publicWorkspaces[0]);
	} finally {
		await rm(root, { force: true, recursive: true });
	}
});

test("rejects duplicate workspace package names", async () => {
	const root = await createRepository({
		workspaces: ["packages/b", "packages/a"],
		manifests: {
			"packages/a": { name: "@example/duplicate" },
			"packages/b": { name: "@example/duplicate" },
		},
	});

	try {
		await assert.rejects(readWorkspaceInventory(root), /Duplicate workspace package name: @example\/duplicate/);
	} finally {
		await rm(root, { force: true, recursive: true });
	}
});

async function createRepository({ workspaces, manifests }) {
	const root = await mkdtemp(path.join(os.tmpdir(), "serve-tools-workspaces-"));

	await writeJSON(path.join(root, "package.json"), { private: true, workspaces });
	await Promise.all(
		Object.entries(manifests).map(async ([location, manifest]) => {
			const workspaceRoot = path.join(root, location);
			await mkdir(workspaceRoot, { recursive: true });
			await writeJSON(path.join(workspaceRoot, "package.json"), manifest);
		}),
	);

	return root;
}

async function writeJSON(file, value) {
	await writeFile(file, `${JSON.stringify(value, null, "\t")}\n`);
}
