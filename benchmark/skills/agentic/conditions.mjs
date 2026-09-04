import { createHash } from "node:crypto";
import { lstat, readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { readWorkspaceInventory } from "../../../scripts/workspaces.mjs";

/**
 * Create immutable documentation snapshots for the three agentic benchmark conditions.
 *
 * The returned virtual files are deliberately independent of benchmark tasks. This keeps
 * package selection and the amount of guidance supplied to the model separable from task
 * fixtures, expected answers, and source tests.
 */
export async function createConditions(root) {
	const resolvedRoot = path.resolve(root);
	const { excludedPackages, packages } = await loadPackages(resolvedRoot);
	const packageMetadata = packages
		.map(({ description, name, version }) => `- ${name}@${version}: ${description}`)
		.join("\n");
	const sharedFiles = Object.fromEntries(
		packages.flatMap(({ declarations, readme }) => [
			[readme.path, readme.source],
			...declarations.map(({ path: declarationPath, source }) => [declarationPath, source]),
		]),
	);
	const standardSchema = await loadStandardSchema(resolvedRoot);

	Object.assign(sharedFiles, standardSchema);
	const docs = createCondition({
		additionalDiscovery: [
			"Use the README and public TypeScript declarations for the selected package.",
			"The package index is at index/packages.md.",
		],
		files: {
			...sharedFiles,
			"index/packages.md": createPackageIndex(packages, "docs"),
		},
		id: "docs",
		excludedPackages,
		packageMetadata,
	});
	const suite = await loadSuite(resolvedRoot);
	const currentFiles = {
		...sharedFiles,
		"index/packages.md": createPackageIndex(packages, "current"),
		...suite,
	};

	for (const packageEntry of packages) {
		currentFiles[packageEntry.skill.path] = packageEntry.skill.source;

		for (const reference of packageEntry.references) {
			currentFiles[reference.path] = reference.source;
		}
	}

	const current = createCondition({
		additionalDiscovery: [
			"Use the suite guide at suite/skills/serve-tools-skills/SKILL.md when package selection is unclear.",
			"Use the selected package Skill and the relevant references it links.",
			"The package Skill index is at index/packages.md.",
		],
		files: currentFiles,
		id: "current",
		excludedPackages,
		packageMetadata,
	});
	const minimalFiles = {
		...sharedFiles,
		"index/packages.md": createPackageIndex(packages, "minimal"),
	};
	const scaffolds = {};

	for (const packageEntry of packages) {
		minimalFiles[packageEntry.router.path] = packageEntry.router.source;
		scaffolds[packageEntry.scaffold.path] = packageEntry.scaffold.source;
	}

	const minimal = createCondition({
		additionalDiscovery: [
			"For a selected package, read its short router from index/packages.md.",
			"Reuse a relevant scaffold with copy_file and targeted edits when useful; otherwise use the README and declarations.",
		],
		files: minimalFiles,
		id: "minimal",
		excludedPackages,
		packageMetadata,
		scaffolds,
	});

	return Object.freeze({ current, docs, minimal });
}

async function loadPackages(root) {
	const { publicWorkspaces } = await readWorkspaceInventory(root);
	const excludedPackages = [];
	const packages = [];

	for (const workspace of publicWorkspaces) {
		if (workspace.name === "@serve-tools/skills") {
			continue;
		}

		try {
			packages.push(await loadPackage(root, workspace));
		} catch (error) {
			if (!(error instanceof IncompletePackageError)) {
				throw error;
			}

			excludedPackages.push({ name: workspace.name, reason: error.message });
		}
	}

	packages.sort((left, right) => left.name.localeCompare(right.name));
	excludedPackages.sort((left, right) => left.name.localeCompare(right.name));

	return { excludedPackages, packages };
}

async function loadPackage(root, workspace) {
	const packageRoot = resolveInside(root, workspace.location);
	const packageJSON = workspace.manifest;
	const packageName = packageDirectory(workspace.name);
	const virtualRoot = `packages/${packageName}`;
	const skillName = workspace.name.replace(/^@/, "").replaceAll("/", "-");
	const readmeSource = await requireText(path.join(packageRoot, "README.md"), "README.md");
	const skillRoot = path.join(packageRoot, "skills", skillName);
	const skillPath = `${virtualRoot}/skills/${skillName}/SKILL.md`;
	const recipePath = path.join(skillRoot, "references", "recipe-quick-start.md");
	const skillSource = await requireText(path.join(skillRoot, "SKILL.md"), "Skill");
	const recipeSource = await requireText(recipePath, "quick-start recipe");
	const scaffoldPath = `${virtualRoot}/scaffolds/recipe-quick-start.ts`;
	const declarations = await loadDeclarations(packageRoot, packageJSON, virtualRoot);
	const references = await readVirtualDirectory(
		root,
		path.join(skillRoot, "references"),
		`${virtualRoot}/skills/${skillName}/references`,
	);
	const scaffold = {
		path: scaffoldPath,
		source: extractTypeScriptRecipe(recipeSource, recipePath),
	};

	return {
		declarations,
		description: packageJSON.description ?? "",
		name: workspace.name,
		readme: { path: `${virtualRoot}/README.md`, source: readmeSource },
		references,
		router: {
			path: `${virtualRoot}/skills/router.md`,
			source: createMinimalRouter(workspace.name, scaffoldPath),
		},
		scaffold,
		skill: { path: skillPath, source: skillSource },
		version: typeof packageJSON.version === "string" ? packageJSON.version : "0.0.0",
	};
}

class IncompletePackageError extends Error {}

async function requireText(file, label) {
	try {
		return await readFile(file, "utf8");
	} catch (error) {
		if (error?.code === "ENOENT") {
			throw new IncompletePackageError(`missing ${label}`);
		}

		throw error;
	}
}

async function loadSuite(root) {
	const suiteRoot = resolveInside(root, "suite/skills/serve-tools-skills");
	const suitePath = "suite/skills/serve-tools-skills";
	const files = [
		{
			path: `${suitePath}/SKILL.md`,
			source: await readFile(path.join(suiteRoot, "SKILL.md"), "utf8"),
		},
		...(await readVirtualDirectory(root, path.join(suiteRoot, "references"), `${suitePath}/references`)),
	];

	return Object.fromEntries(files.map(({ path: filePath, source }) => [filePath, source]));
}

async function loadStandardSchema(root) {
	const packageRoot = resolveInside(root, "node_modules/@standard-schema/spec");
	const files = ["README.md", "dist/index.d.ts"];

	return Object.fromEntries(
		await Promise.all(
			files.map(async (file) => [
				`packages/standard-schema-spec/${file}`,
				await readFile(path.join(packageRoot, file), "utf8"),
			]),
		),
	);
}

async function loadDeclarations(packageRoot, packageJSON, virtualRoot) {
	const pending = declarationPaths(packageJSON.exports);
	const declarations = new Map();

	if (pending.length === 0) {
		throw new IncompletePackageError("missing public declarations");
	}

	for (let declarationPath; (declarationPath = pending.shift()) !== undefined; ) {
		if (declarations.has(declarationPath)) {
			continue;
		}

		const sourcePath = resolveInside(packageRoot, declarationPath);
		let source;

		try {
			const stat = await lstat(sourcePath);

			if (!stat.isFile()) {
				throw new IncompletePackageError(`missing public declaration ${declarationPath}`);
			}

			source = await readFile(sourcePath, "utf8");
		} catch (error) {
			if (error?.code === "ENOENT") {
				throw new IncompletePackageError(`missing public declaration ${declarationPath}`);
			}

			throw error;
		}

		declarations.set(declarationPath, source);

		for (const dependency of declarationDependencies(declarationPath, source)) {
			if (!declarations.has(dependency)) {
				pending.push(dependency);
			}
		}
	}

	if (declarations.size === 0) {
		throw new IncompletePackageError("missing public declarations");
	}

	return [...declarations]
		.map(([declarationPath, source]) => ({ path: `${virtualRoot}/${declarationPath}`, source }))
		.sort((left, right) => left.path.localeCompare(right.path));
}

function declarationPaths(exports) {
	const targets = new Set();
	collectExportTargets(exports, targets);

	return [...targets]
		.filter((target) => target.startsWith("./") && !target.includes("*"))
		.map((target) => target.replace(/^\.\//, "").replace(/\.js$/, ".d.ts"))
		.filter((target) => target.endsWith(".d.ts"))
		.sort();
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

function declarationDependencies(declarationPath, source) {
	const dependencies = new Set();
	const base = path.posix.dirname(declarationPath);

	for (const match of source.matchAll(/(?:from\s*|import\s*\(|reference\s+path=)["']([^"']+)["']/g)) {
		const specifier = match[1];

		if (!specifier.startsWith(".")) {
			continue;
		}

		const dependency = path.posix.normalize(path.posix.join(base, specifier)).replace(/\.js$/, ".d.ts");

		if (dependency.endsWith(".d.ts") && !dependency.startsWith("../")) {
			dependencies.add(dependency);
		}
	}

	return [...dependencies];
}

async function readVirtualDirectory(root, directory, virtualDirectory) {
	const files = [];

	for (const entry of await readdir(directory, { withFileTypes: true })) {
		const sourcePath = path.join(directory, entry.name);
		const virtualPath = `${virtualDirectory}/${entry.name}`;

		if (entry.isDirectory()) {
			files.push(...(await readVirtualDirectory(root, sourcePath, virtualPath)));
		} else if (entry.isFile()) {
			files.push({ path: virtualPath, source: await readFile(resolveInside(root, sourcePath), "utf8") });
		}
	}

	return files.sort((left, right) => left.path.localeCompare(right.path));
}

function createPackageIndex(packages, variant) {
	const lines = ["# Package index", ""];

	for (const packageEntry of packages) {
		lines.push(`- ${packageEntry.name}@${packageEntry.version}: ${packageEntry.description}`);
		lines.push(`  - README: ${packageEntry.readme.path}`);

		if (variant === "current") {
			lines.push(`  - Skill: ${packageEntry.skill.path}`);
		} else if (variant === "minimal") {
			lines.push(`  - Router: ${packageEntry.router.path}`);
			lines.push(`  - Scaffold: ${packageEntry.scaffold.path}`);
		}
	}

	return `${lines.join("\n")}\n`;
}

function createMinimalRouter(packageName, scaffoldPath) {
	return [
		`# ${packageName}`,
		"",
		`Reuse [the quick-start scaffold](${scaffoldPath}) with copy_file and targeted edits when it fits the request.`,
		"Otherwise use the README and public declarations.",
		"Preserve lifecycle, ownership, cancellation, failure, and cleanup contracts.",
		"Validate the behavior relevant to the request.",
		"",
	].join("\n");
}

function extractTypeScriptRecipe(source, recipePath) {
	const match = /^```ts\n([\s\S]*?)\n```$/m.exec(source);

	if (match === null) {
		throw new Error(`Expected one TypeScript recipe fence in ${recipePath}`);
	}

	return `${match[1]}\n`;
}

function createCondition({ additionalDiscovery, excludedPackages, files, id, packageMetadata, scaffolds = {} }) {
	const discovery = ["Available @serve-tools packages:", packageMetadata, "", ...additionalDiscovery].join("\n");
	const condition = {
		discovery,
		excludedPackages,
		files: sortRecord(files),
		id,
		scaffolds: sortRecord(scaffolds),
	};

	return deepFreeze({ ...condition, sha256: hashCondition(condition) });
}

function hashCondition({ discovery, excludedPackages, files, id, scaffolds }) {
	const hash = createHash("sha256");

	for (const [path, source] of [
		["id", id],
		["discovery", discovery],
		["excludedPackages", JSON.stringify(excludedPackages)],
		...Object.entries(files).flatMap(([filePath, source]) => [[`files/${filePath}`, source]]),
		...Object.entries(scaffolds).flatMap(([scaffoldPath, source]) => [[`scaffolds/${scaffoldPath}`, source]]),
	]) {
		hash.update(path);
		hash.update("\0");
		hash.update(source);
		hash.update("\0");
	}

	return hash.digest("hex");
}

function sortRecord(record) {
	return Object.fromEntries(Object.entries(record).sort(([left], [right]) => left.localeCompare(right)));
}

function deepFreeze(value) {
	if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
		Object.freeze(value);

		for (const nested of Object.values(value)) {
			deepFreeze(nested);
		}
	}

	return value;
}

function packageDirectory(packageName) {
	const name = packageName.replace(/^@serve-tools\//, "");

	if (!/^[a-z0-9][a-z0-9._-]*$/i.test(name)) {
		throw new Error(`Unsafe package name for virtual path: ${packageName}`);
	}

	return name;
}

function resolveInside(root, candidate) {
	const resolvedRoot = path.resolve(root);
	const resolved = path.resolve(resolvedRoot, candidate);

	if (resolved !== resolvedRoot && !resolved.startsWith(`${resolvedRoot}${path.sep}`)) {
		throw new Error(`Path escapes the repository: ${candidate}`);
	}

	return resolved;
}
