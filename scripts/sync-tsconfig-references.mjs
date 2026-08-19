import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const write = process.argv.includes("--write");
const unknownArguments = process.argv.slice(2).filter((argument) => argument !== "--write");

if (unknownArguments.length > 0) {
	throw new Error(`Unknown argument${unknownArguments.length === 1 ? "" : "s"}: ${unknownArguments.join(", ")}`);
}

const rootPackage = await readJSON(path.join(root, "package.json"));
const workspacePaths = getWorkspacePaths(rootPackage.workspaces);
const workspaces = [];
const workspacesByName = new Map();

for (const workspacePath of workspacePaths) {
	const workspaceRoot = path.join(root, workspacePath);
	const packageJSON = await readJSON(path.join(workspaceRoot, "package.json"));
	const workspace = {
		name: packageJSON.name,
		packageJSON,
		projectConfig: await getProjectConfig(workspaceRoot, packageJSON),
		root: workspaceRoot,
	};

	if (workspacesByName.has(workspace.name)) {
		throw new Error(`Duplicate workspace package name: ${workspace.name}`);
	}

	workspaces.push(workspace);
	workspacesByName.set(workspace.name, workspace);
}

validateProductionGraph();

const expectedReferences = new Map();
const solutionPath = path.join(root, "tsconfig.build.json");
const solutionReferences = workspaces
	.filter(
		(workspace) =>
			workspace.packageJSON.scripts?.build?.includes("tsc --build") && workspace.projectConfig !== null,
	)
	.map((workspace) => relativeReference(solutionPath, workspace.projectConfig));

expectedReferences.set(solutionPath, solutionReferences);

for (const workspace of workspaces) {
	const entries = await readdir(workspace.root, { withFileTypes: true });
	const configs = entries
		.filter((entry) => entry.isFile() && /^tsconfig(?:\..+)?\.json$/.test(entry.name))
		.map((entry) => path.join(workspace.root, entry.name))
		.sort();

	for (const configPath of configs) {
		const developmentConfig = !["tsconfig.json", "tsconfig.build.json"].includes(path.basename(configPath));
		const dependencies = getInternalDependencies(workspace.packageJSON, developmentConfig);
		const references = dependencies.map((dependency) => {
			const dependencyConfig = workspacesByName.get(dependency).projectConfig;
			if (dependencyConfig === null) {
				throw new Error(`${workspace.name} depends on ${dependency}, which has no TypeScript project config`);
			}

			return relativeReference(configPath, dependencyConfig);
		});

		expectedReferences.set(configPath, references);
	}
}

const changes = [];

for (const [configPath, references] of expectedReferences) {
	const source = await readFile(configPath, "utf8");
	const config = JSON.parse(source);
	const actual = (config.references ?? []).map((reference) => reference.path);

	if (actual.length === references.length && actual.every((reference, index) => reference === references[index])) {
		continue;
	}

	changes.push({ actual, configPath, references });

	if (write) {
		await writeFile(configPath, updateReferences(source, references));
	}
}

if (changes.length === 0) {
	console.log(`Validated TypeScript project references in ${expectedReferences.size} configurations.`);
} else if (write) {
	for (const change of changes) {
		console.log(`Updated ${path.relative(root, change.configPath)}.`);
	}

	console.log(`Updated TypeScript project references in ${changes.length} configurations.`);
} else {
	console.error(`TypeScript project references are out of date in ${changes.length} configurations:`);

	for (const { actual, configPath, references } of changes) {
		console.error(`\n${path.relative(root, configPath)}`);
		for (const reference of actual.filter((reference) => !references.includes(reference))) {
			console.error(`- ${reference}`);
		}
		for (const reference of references.filter((reference) => !actual.includes(reference))) {
			console.error(`+ ${reference}`);
		}
		if (actual.length === references.length && actual.every((reference) => references.includes(reference))) {
			console.error("~ reference order differs");
		}
	}

	console.error("\nRun `npm run sync:tsconfig-references` to update them.");
	process.exitCode = 1;
}

function getWorkspacePaths(workspacePatterns) {
	if (!Array.isArray(workspacePatterns)) {
		throw new TypeError("package.json workspaces must be an array");
	}

	for (const workspacePattern of workspacePatterns) {
		if (workspacePattern.includes("*")) {
			throw new Error(`Workspace globs are not supported: ${workspacePattern}`);
		}
	}

	return workspacePatterns;
}

async function getProjectConfig(workspaceRoot, packageJSON) {
	const build = packageJSON.scripts?.build ?? "";
	const match = /(?:^|&&\s*)tsc --build(?:\s+([^\s&]+))?/.exec(build);
	const configName = match?.[1] ?? "tsconfig.json";
	const configPath = path.join(workspaceRoot, configName);

	try {
		await readFile(configPath);
	} catch (error) {
		if (error?.code !== "ENOENT") {
			throw error;
		}
		if (match === null) {
			return null;
		}

		throw new Error(`${packageJSON.name} resolves to missing project config ${path.relative(root, configPath)}`);
	}

	return configPath;
}

function getInternalDependencies(packageJSON, includeDevelopment) {
	const sections = [packageJSON.dependencies, packageJSON.optionalDependencies, packageJSON.peerDependencies];

	if (includeDevelopment) {
		sections.push(packageJSON.devDependencies);
	}

	const dependencies = new Set();
	for (const section of sections) {
		for (const dependency of Object.keys(section ?? {})) {
			if (workspacesByName.has(dependency)) {
				dependencies.add(dependency);
			}
		}
	}

	return [...dependencies];
}

function relativeReference(fromConfig, toConfig) {
	let relative = path.relative(path.dirname(fromConfig), toConfig).replaceAll(path.sep, "/");

	if (!relative.startsWith(".")) {
		relative = `./${relative}`;
	}

	return relative;
}

function updateReferences(source, references) {
	const property = /(^\t"references"\s*:\s*)\[/m.exec(source);
	const formatted = formatReferences(references);

	if (property !== null) {
		const arrayStart = property.index + property[1].length;
		const arrayEnd = findArrayEnd(source, arrayStart);

		if (references.length > 0) {
			return `${source.slice(0, arrayStart)}${formatted}${source.slice(arrayEnd + 1)}`;
		}

		const lineStart = source.lastIndexOf("\n", property.index) + 1;
		let propertyEnd = arrayEnd + 1;
		while (source[propertyEnd] === " " || source[propertyEnd] === "\t") {
			++propertyEnd;
		}
		let trailingComma = false;
		if (source[propertyEnd] === ",") {
			trailingComma = true;
			++propertyEnd;
		}
		if (source[propertyEnd] === "\r") {
			++propertyEnd;
		}
		if (source[propertyEnd] === "\n") {
			++propertyEnd;
		}

		let before = source.slice(0, lineStart);
		const previous = before.match(/,\s*$/);
		if (!trailingComma && previous !== null) {
			before = before.slice(0, previous.index) + before.slice(previous.index + 1);
		}

		return before + source.slice(propertyEnd);
	}

	if (references.length === 0) {
		return source;
	}

	const objectEnd = source.lastIndexOf("\n}");
	if (objectEnd === -1) {
		throw new Error("Expected a top-level JSON object ending on its own line");
	}

	const before = source.slice(0, objectEnd).trimEnd();
	const comma = before.endsWith("{") ? "" : ",";

	return `${before}${comma}\n\t"references": ${formatted}${source.slice(objectEnd)}`;
}

function findArrayEnd(source, arrayStart) {
	let depth = 0;
	let escaped = false;
	let string = false;

	for (let index = arrayStart; index < source.length; ++index) {
		const character = source[index];

		if (string) {
			if (escaped) {
				escaped = false;
			} else if (character === "\\") {
				escaped = true;
			} else if (character === '"') {
				string = false;
			}
			continue;
		}

		if (character === '"') {
			string = true;
		} else if (character === "[") {
			++depth;
		} else if (character === "]" && --depth === 0) {
			return index;
		}
	}

	throw new Error("Unterminated references array");
}

function formatReferences(references) {
	if (references.length === 0) {
		return "[]";
	}

	return `[\n${references.map((reference) => `\t\t{\n\t\t\t"path": ${JSON.stringify(reference)}\n\t\t}`).join(",\n")}\n\t]`;
}

function validateProductionGraph() {
	const visiting = new Set();
	const visited = new Set();

	for (const workspace of workspaces) {
		visit(workspace, []);
	}

	function visit(workspace, ancestors) {
		if (visited.has(workspace.name)) {
			return;
		}
		if (visiting.has(workspace.name)) {
			throw new Error(`Circular workspace dependency: ${[...ancestors, workspace.name].join(" -> ")}`);
		}

		visiting.add(workspace.name);
		for (const dependency of getInternalDependencies(workspace.packageJSON, false)) {
			visit(workspacesByName.get(dependency), [...ancestors, workspace.name]);
		}
		visiting.delete(workspace.name);
		visited.add(workspace.name);
	}
}

async function readJSON(file) {
	return JSON.parse(await readFile(file, "utf8"));
}
