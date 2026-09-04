import { cp, lstat, mkdir, mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { readWorkspaceInventory } from "../../../scripts/workspaces.mjs";

const runtimes = new Map();

/** Create one immutable, publish-shaped dependency runtime for artifact validators. */
export async function prepareRuntime(root) {
	const resolvedRoot = path.resolve(root);
	const existing = runtimes.get(resolvedRoot);

	if (existing !== undefined) {
		return existing;
	}

	const pending = createRuntime(resolvedRoot).catch((error) => {
		runtimes.delete(resolvedRoot);

		throw error;
	});

	runtimes.set(resolvedRoot, pending);

	return pending;
}

/** Remove every cached validator runtime. Call after an experiment completes. */
export async function cleanupRuntime() {
	const pending = [...runtimes.values()];

	runtimes.clear();

	for (const runtime of pending) {
		const { directory } = await runtime;

		await rm(directory, { force: true, recursive: true });
	}
}

async function createRuntime(root) {
	const directory = await mkdtemp(path.join(temporaryRoot(), "serve-tools-agentic-runtime-"));
	const nodeModules = path.join(directory, "node_modules");

	try {
		await mkdir(nodeModules, { recursive: true });

		const { publicWorkspaces } = await readWorkspaceInventory(root);
		const workspaceNames = new Set(publicWorkspaces.map((workspace) => workspace.name));
		const external = new Set(["@types/node", "typescript", "undici-types"]);

		for (const workspace of publicWorkspaces) {
			await copyWorkspacePackage(workspace, nodeModules);

			for (const dependency of dependencyNames(workspace.manifest)) {
				if (!workspaceNames.has(dependency)) {
					external.add(dependency);
				}
			}
		}

		for (const packageName of external) {
			await copyExternalPackage(root, nodeModules, packageName);
		}

		return Object.freeze({ directory, nodeModules, tsc: path.join(nodeModules, "typescript", "bin", "tsc") });
	} catch (error) {
		await rm(directory, { force: true, recursive: true });

		throw error;
	}
}

function temporaryRoot() {
	return process.platform === "darwin" ? "/private/tmp" : os.tmpdir();
}

async function copyWorkspacePackage(workspace, nodeModules) {
	const destination = packageDirectory(nodeModules, workspace.name);

	await mkdir(destination, { recursive: true });
	await cp(path.join(workspace.root, "package.json"), path.join(destination, "package.json"));

	for (const directory of publicDirectories(workspace.manifest.exports)) {
		const source = path.join(workspace.root, directory);

		if (await isDirectory(source)) {
			await cp(source, path.join(destination, directory), { recursive: true });
		}
	}
}

async function copyExternalPackage(root, nodeModules, packageName, optional = false) {
	const destination = packageDirectory(nodeModules, packageName);

	if (await exists(destination)) {
		return;
	}

	const source = packageDirectory(path.join(root, "node_modules"), packageName);
	let manifest;

	try {
		manifest = JSON.parse(await readFile(path.join(source, "package.json"), "utf8"));
	} catch (error) {
		if (optional && error?.code === "ENOENT") {
			return;
		}

		throw error;
	}

	await mkdir(path.dirname(destination), { recursive: true });
	await cp(source, destination, { dereference: true, recursive: true });

	for (const dependency of Object.keys(manifest.dependencies ?? {})) {
		if (!dependency.startsWith("@serve-tools/")) {
			await copyExternalPackage(root, nodeModules, dependency);
		}
	}

	for (const dependency of Object.keys(manifest.optionalDependencies ?? {})) {
		if (!dependency.startsWith("@serve-tools/")) {
			await copyExternalPackage(root, nodeModules, dependency, true);
		}
	}
}

function dependencyNames(manifest) {
	return Object.keys(manifest.dependencies ?? {});
}

function publicDirectories(exports) {
	const targets = new Set();
	collectExportTargets(exports, targets);

	return [
		...new Set(
			[...targets]
				.filter((target) => target.startsWith("./"))
				.map((target) => target.slice(2).split("/")[0])
				.filter((directory) => directory.length > 0 && directory !== "package.json"),
		),
	];
}

function collectExportTargets(value, targets) {
	if (typeof value === "string") {
		targets.add(value);

		return;
	}

	if (value === null || typeof value !== "object" || Array.isArray(value)) {
		return;
	}

	for (const nested of Object.values(value)) {
		collectExportTargets(nested, targets);
	}
}

function packageDirectory(base, packageName) {
	if (!/^(?:@[-a-z0-9._]+\/)?[-a-z0-9._]+$/i.test(packageName)) {
		throw new Error(`Unsafe package name: ${packageName}`);
	}

	return path.join(base, ...packageName.split("/"));
}

async function exists(target) {
	try {
		await lstat(target);

		return true;
	} catch (error) {
		if (error?.code === "ENOENT") {
			return false;
		}

		throw error;
	}
}

async function isDirectory(target) {
	try {
		return (await lstat(target)).isDirectory();
	} catch (error) {
		if (error?.code === "ENOENT") {
			return false;
		}

		throw error;
	}
}
