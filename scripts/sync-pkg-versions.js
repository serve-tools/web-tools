// @ts-check
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readWorkspaceInventory } from "./workspaces.mjs";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const check = process.argv.includes("--check");
const unknownArguments = process.argv.slice(2).filter((argument) => argument !== "--check");

if (unknownArguments.length > 0) {
	throw new Error(`Unknown argument${unknownArguments.length === 1 ? "" : "s"}: ${unknownArguments.join(", ")}`);
}

const { workspaces, workspacesByName } = await readWorkspaceInventory(root);
const changes = [];
const changedWorkspaces = new Set();

for (const workspace of workspaces) {
	for (const dependencyType of /** @type {const} */ (["dependencies", "devDependencies"])) {
		for (const [dependencyName, version] of Object.entries(workspace.manifest[dependencyType] ?? {})) {
			const dependency = workspacesByName.get(dependencyName);

			if (dependency === undefined) {
				continue;
			}

			const expectedVersion = `^${dependency.manifest.version}`;

			if (version === expectedVersion) {
				continue;
			}

			changes.push({ dependencyName, dependencyType, expectedVersion, version, workspace });
			changedWorkspaces.add(workspace);
			workspace.manifest[dependencyType][dependencyName] = expectedVersion;
		}
	}
}

for (const { dependencyName, dependencyType, expectedVersion, version, workspace } of changes) {
	const message = `${workspace.location}/package.json#${dependencyType}#${dependencyName} from ${version} to ${expectedVersion}`;
	console[check ? "error" : "log"](`${check ? "Expected" : "Updating"} ${message}.`);
}

if (check && changes.length > 0) {
	process.exitCode = 1;
} else if (!check) {
	await Promise.all(
		[...changedWorkspaces].map(({ manifest, root: workspaceRoot }) =>
			writeFile(path.join(workspaceRoot, "package.json"), `${JSON.stringify(manifest, null, "\t")}\n`),
		),
	);
}

if (changes.length === 0) {
	console.log(`Validated internal dependency versions in ${workspaces.length} workspaces.`);
}
