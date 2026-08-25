import { readFile } from "node:fs/promises";
import path from "node:path";

/** Read and validate the workspaces declared by a repository root. */
export async function readWorkspaceInventory(root) {
	const resolvedRoot = path.resolve(root);
	const rootManifest = await readJSON(path.join(resolvedRoot, "package.json"));
	const locations = getWorkspaceLocations(rootManifest.workspaces);
	const workspaces = await Promise.all(
		locations.map(async (location) => {
			const workspaceRoot = path.resolve(resolvedRoot, location);
			const relativeRoot = path.relative(resolvedRoot, workspaceRoot);

			if (relativeRoot === "" || relativeRoot.startsWith("..") || path.isAbsolute(relativeRoot)) {
				throw new Error(`Workspace escapes the repository: ${location}`);
			}

			const manifest = await readJSON(path.join(workspaceRoot, "package.json"));

			if (typeof manifest.name !== "string" || manifest.name.length === 0) {
				throw new Error(`${location}: workspace package name is required`);
			}

			return { location, manifest, name: manifest.name, root: workspaceRoot };
		}),
	);

	workspaces.sort((left, right) => compareLocations(left.location, right.location));

	const locationsSeen = new Set();
	const workspacesByName = new Map();

	for (const workspace of workspaces) {
		if (locationsSeen.has(workspace.location)) {
			throw new Error(`Duplicate workspace location: ${workspace.location}`);
		}
		if (workspacesByName.has(workspace.name)) {
			throw new Error(`Duplicate workspace package name: ${workspace.name}`);
		}

		locationsSeen.add(workspace.location);
		workspacesByName.set(workspace.name, workspace);
	}

	const publicWorkspaces = workspaces.filter(({ manifest }) => !manifest.private);
	const privateWorkspaces = workspaces.filter(({ manifest }) => manifest.private);

	return { root: resolvedRoot, workspaces, publicWorkspaces, privateWorkspaces, workspacesByName };
}

function getWorkspaceLocations(workspaces) {
	if (!Array.isArray(workspaces)) {
		throw new TypeError("package.json workspaces must be an array");
	}

	return workspaces.map((location) => {
		if (typeof location !== "string" || location.length === 0) {
			throw new TypeError("package.json workspace locations must be non-empty strings");
		}
		if (/[*?{}[\]]/.test(location)) {
			throw new Error(`Workspace globs are not supported: ${location}`);
		}

		return location;
	});
}

function compareLocations(left, right) {
	const leftParts = left.split("/");
	const rightParts = right.split("/");

	for (let index = 0; index < Math.min(leftParts.length, rightParts.length); ++index) {
		if (leftParts[index] < rightParts[index]) {
			return -1;
		}
		if (leftParts[index] > rightParts[index]) {
			return 1;
		}
	}

	return leftParts.length - rightParts.length;
}

async function readJSON(file) {
	return JSON.parse(await readFile(file, "utf8"));
}
