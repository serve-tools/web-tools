import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { readWorkspaceInventory } from "../../../scripts/workspaces.mjs";

/** Fingerprint the installed workspace runtime, including uncommitted build outputs. */
export async function runtimeFingerprint(root) {
	const { publicWorkspaces } = await readWorkspaceInventory(root);
	const hash = createHash("sha256");
	hash.update(await readFile(path.join(root, "package-lock.json")));
	for (const workspace of publicWorkspaces.toSorted((left, right) => left.location.localeCompare(right.location))) {
		hash.update(workspace.location);
		hash.update(await readFile(path.join(workspace.root, "package.json")));
		for (const file of await filesUnder(path.join(workspace.root, "dist"))) {
			if (!file.endsWith(".js")) {
				continue;
			}
			hash.update(path.relative(root, file));
			hash.update(await readFile(file));
		}
	}
	return hash.digest("hex");
}

export async function filesUnder(directory) {
	let entries;
	try {
		entries = await readdir(directory, { withFileTypes: true });
	} catch (error) {
		if (error.code === "ENOENT") {
			return [];
		}
		throw error;
	}
	const files = [];
	for (const entry of entries) {
		const file = path.join(directory, entry.name);
		if (entry.isDirectory()) {
			files.push(...(await filesUnder(file)));
		} else if (entry.isFile()) {
			files.push(file);
		}
	}
	return files.sort();
}
