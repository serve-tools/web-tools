import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readWorkspaceInventory } from "../workspaces.mjs";

const dependencySections = ["dependencies", "devDependencies", "optionalDependencies", "peerDependencies"];
const ignoredDirectories = new Set([".git", "dist", "node_modules"]);
const sourceExtensions = new Set([".cjs", ".cts", ".js", ".mjs", ".mts", ".ts"]);

/** Read the TypeScript migration facts that can be collected without installing or building. */
export async function readTypeScriptMigrationInventory(root) {
	const { root: resolvedRoot, workspaces } = await readWorkspaceInventory(root);
	const rootManifest = await readJSON(path.join(resolvedRoot, "package.json"));
	const manifests = [
		{ location: "", manifest: rootManifest, name: rootManifest.name },
		...workspaces.map(({ location, manifest, name }) => ({ location, manifest, name })),
	];
	const compilerPins = collectCompilerPins(manifests);
	const projectReferences = await collectProjectReferences(resolvedRoot, workspaces);

	return {
		schemaVersion: 1,
		root: {
			path: resolvedRoot,
			packageManager: rootManifest.packageManager ?? null,
			runtime: { arch: process.arch, node: process.version, platform: process.platform },
		},
		compilerPins,
		compilerApiConsumerCandidates: await findCompilerApiConsumerCandidates(resolvedRoot),
		demos: collectDemos(workspaces),
		buildDependencyScripts: collectBuildDependencyScripts(workspaces),
		projectReferences,
		olderCompilerPins: findOlderCompilerPins(compilerPins),
	};
}

function collectCompilerPins(manifests) {
	const pins = [];

	for (const { location, manifest, name } of manifests) {
		for (const section of dependencySections) {
			const version = manifest[section]?.typescript;

			if (typeof version === "string") {
				pins.push({ location: manifestLocation(location), name, section, version });
			}
		}
	}

	return pins;
}

function collectDemos(workspaces) {
	return workspaces
		.filter(({ location }) => location.endsWith("/demo"))
		.map(({ location, manifest, name }) => ({
			location,
			name,
			buildBundle: manifest.scripts?.["build:bundle"] ?? null,
			buildDependencies: manifest.scripts?.["build:dependencies"] ?? null,
		}));
}

function collectBuildDependencyScripts(workspaces) {
	return workspaces.flatMap(({ location, manifest, name }) => {
		const script = manifest.scripts?.["build:dependencies"];

		return typeof script === "string" ? [{ location, name, script }] : [];
	});
}

async function collectProjectReferences(root, workspaces) {
	const rootConfig = "tsconfig.build.json";
	const workspaceConfigs = await Promise.all(
		workspaces.map(async ({ location, root: workspaceRoot }) => ({
			location,
			configs: await collectConfigReferences(root, workspaceRoot),
		})),
	);

	return {
		root: { config: rootConfig, references: await readConfigReferences(root, path.join(root, rootConfig)) },
		workspaces: workspaceConfigs,
	};
}

async function collectConfigReferences(root, workspaceRoot) {
	const entries = await readdir(workspaceRoot, { withFileTypes: true });
	const configNames = entries
		.filter((entry) => entry.isFile() && /^tsconfig(?:\.[^.]+)*\.json$/.test(entry.name))
		.map((entry) => entry.name)
		.sort();

	return Promise.all(
		configNames.map(async (config) => ({
			config: toRelativePath(root, path.join(workspaceRoot, config)),
			references: await readConfigReferences(root, path.join(workspaceRoot, config)),
		})),
	);
}

async function readConfigReferences(root, configFile) {
	const config = await readJSON(configFile);

	if (!Array.isArray(config.references)) {
		return [];
	}

	return config.references
		.map((reference) => reference?.path)
		.filter((reference) => typeof reference === "string")
		.map((reference) => toRelativePath(root, path.resolve(path.dirname(configFile), reference)))
		.sort();
}

/**
 * Collect static candidates from literal TypeScript module specifiers.
 * This intentionally does not interpret code, resolve variables, or claim exhaustive compiler API discovery.
 */
async function findCompilerApiConsumerCandidates(root) {
	const files = [];

	for await (const file of walkFiles(root)) {
		if (!sourceExtensions.has(path.extname(file))) {
			continue;
		}

		const source = await readFile(file, "utf8");

		if (referencesCompilerModule(source)) {
			files.push(toRelativePath(root, file));
		}
	}

	return files.sort();
}

async function* walkFiles(directory) {
	const entries = await readdir(directory, { withFileTypes: true });

	for (const entry of entries) {
		if (entry.isDirectory()) {
			if (!ignoredDirectories.has(entry.name)) {
				yield* walkFiles(path.join(directory, entry.name));
			}
			continue;
		}

		if (entry.isFile()) {
			yield path.join(directory, entry.name);
		}
	}
}

function referencesCompilerModule(source) {
	return /\bfrom\s*["']typescript(?:\/[^"']*)?["']|\brequire\(\s*["']typescript(?:\/[^"']*)?["']\s*\)|\bimport\(\s*["']typescript(?:\/[^"']*)?["']\s*\)|\brequire\.resolve\(\s*["']typescript(?:\/[^"']*)?["']\s*\)|\bimport\.meta\.resolve\(\s*["']typescript(?:\/[^"']*)?["']\s*\)/.test(
		source,
	);
}

function findOlderCompilerPins(compilerPins) {
	const rootPin = compilerPins.find(({ location }) => location === "package.json");

	if (!rootPin) {
		return [];
	}

	const rootVersion = parseVersion(rootPin.version);

	if (!rootVersion) {
		return [];
	}

	return compilerPins.filter((pin) => {
		const version = parseVersion(pin.version);
		return pin.location !== "package.json" && version && compareVersions(version, rootVersion) < 0;
	});
}

function parseVersion(version) {
	const match = /^(\d+)\.(\d+)\.(\d+)(?:[-+].*)?$/.exec(version);
	return match?.slice(1).map(Number) ?? null;
}

function compareVersions(left, right) {
	for (let index = 0; index < left.length; ++index) {
		if (left[index] !== right[index]) {
			return left[index] - right[index];
		}
	}

	return 0;
}

function manifestLocation(location) {
	return location ? `${location}/package.json` : "package.json";
}

function toRelativePath(root, target) {
	return path.relative(root, target).split(path.sep).join("/");
}

async function readJSON(file) {
	return JSON.parse(await readFile(file, "utf8"));
}

function parseArguments(arguments_) {
	let root = fileURLToPath(new URL("../../", import.meta.url));
	let hasRoot = false;

	for (let index = 0; index < arguments_.length; ++index) {
		const argument = arguments_[index];

		if (argument !== "--root") {
			throw new Error(`Unknown argument: ${argument}`);
		}
		if (hasRoot) {
			throw new Error("--root may only be provided once");
		}

		const value = arguments_[++index];
		if (value === undefined || value.startsWith("--")) {
			throw new Error("Missing value for --root");
		}

		root = value;
		hasRoot = true;
	}

	return root;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
	try {
		console.log(
			JSON.stringify(await readTypeScriptMigrationInventory(parseArguments(process.argv.slice(2))), null, "\t"),
		);
	} catch (error) {
		console.error(error instanceof Error ? error.message : error);
		process.exitCode = 1;
	}
}
