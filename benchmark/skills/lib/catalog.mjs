import { readFile } from "node:fs/promises";
import path from "node:path";

export async function loadCatalog(root) {
	const rootPackage = await readJSON(path.join(root, "package.json"));
	const packages = [];

	for (const workspace of rootPackage.workspaces) {
		const packageRoot = path.join(root, workspace);
		const packageJSON = await readJSON(path.join(packageRoot, "package.json"));

		if (packageJSON.private || packageJSON.name === "@serve-tools/skills") {
			continue;
		}

		const skillName = packageJSON.name.replace(/^@/, "").replaceAll("/", "-");
		const skillRoot = path.join(packageRoot, "skills", skillName);
		const skillPath = relative(root, path.join(skillRoot, "SKILL.md"));
		const skillSource = await readFile(path.join(skillRoot, "SKILL.md"), "utf8");
		const metadata = parseFrontmatter(skillSource);
		const references = [];

		for (const match of skillSource.matchAll(/\[([^\]]+)\]\(references\/([^)#]+)(?:#[^)]+)?\)/g)) {
			const referencePath = relative(root, path.join(skillRoot, "references", match[2]));

			if (!references.some((reference) => reference.path === referencePath)) {
				references.push({ title: match[1], path: referencePath });
			}
		}

		packages.push({
			description: packageJSON.description,
			name: packageJSON.name,
			readmePath: relative(root, path.join(packageRoot, "README.md")),
			references,
			skillDescription: metadata.description,
			skillName: metadata.name,
			skillPath,
			workspace,
		});
	}

	packages.sort((left, right) => left.name.localeCompare(right.name));

	return { packages, root };
}

export async function createDiscoveryContext(catalog, variant, kind) {
	if (variant === "baseline") {
		return [
			"Available packages and their installed README documents:",
			...catalog.packages.map(
				(packageEntry) => `- ${packageEntry.name}: ${packageEntry.description} [${packageEntry.readmePath}]`,
			),
		].join("\n");
	}

	const suiteRoot = path.join(catalog.root, "suite", "skills", "serve-tools-skills");
	const suitePaths = ["SKILL.md", "references/package-selection.md"];

	if (kind === "composition") {
		suitePaths.push("references/common-combinations.md");
	}

	const suiteDocuments = await Promise.all(
		suitePaths.map(async (document) => {
			const documentPath = relative(catalog.root, path.join(suiteRoot, document));
			return formatDocument(documentPath, await readFile(path.join(suiteRoot, document), "utf8"));
		}),
	);

	return [
		...suiteDocuments,
		"Package Skill discovery metadata:",
		...catalog.packages.map((packageEntry) => `- ${packageEntry.skillName}: ${packageEntry.skillDescription}`),
	].join("\n\n");
}

export function allowedDocuments(catalog, packages, variant) {
	const selected = new Set(packages);
	const documents = new Set();

	for (const packageEntry of catalog.packages) {
		if (!selected.has(packageEntry.name)) {
			continue;
		}

		if (variant === "baseline") {
			documents.add(packageEntry.readmePath);
			continue;
		}

		documents.add(packageEntry.skillPath);

		for (const reference of packageEntry.references) {
			documents.add(reference.path);
		}
	}

	return documents;
}

export async function loadDocuments(catalog, documentPaths) {
	const documents = [];

	for (const documentPath of documentPaths) {
		const absolutePath = path.resolve(catalog.root, documentPath);

		if (!absolutePath.startsWith(`${path.resolve(catalog.root)}${path.sep}`)) {
			throw new Error(`Document escapes the repository: ${documentPath}`);
		}

		documents.push(formatDocument(documentPath, await readFile(absolutePath, "utf8")));
	}

	return documents.join("\n\n");
}

export function normalizeRoute(catalog, route, variant) {
	const knownPackages = new Set(catalog.packages.map((packageEntry) => packageEntry.name));
	const packages = uniqueStrings(route.packages).filter((packageName) => knownPackages.has(packageName));
	const allowed = allowedDocuments(catalog, packages, variant);
	const documents = uniqueStrings(route.documents).filter((document) => allowed.has(document));

	if (variant === "baseline") {
		for (const packageName of packages) {
			const packageEntry = catalog.packages.find((candidate) => candidate.name === packageName);

			if (packageEntry !== undefined && !documents.includes(packageEntry.readmePath)) {
				documents.push(packageEntry.readmePath);
			}
		}
	} else {
		for (const packageName of packages) {
			const packageEntry = catalog.packages.find((candidate) => candidate.name === packageName);

			if (packageEntry !== undefined && !documents.includes(packageEntry.skillPath)) {
				documents.unshift(packageEntry.skillPath);
			}
		}
	}

	return { documents, packages, rationale: typeof route.rationale === "string" ? route.rationale : "" };
}

async function readJSON(file) {
	return JSON.parse(await readFile(file, "utf8"));
}

function parseFrontmatter(source) {
	const match = /^---\n([\s\S]*?)\n---\n/.exec(source);

	if (match === null) {
		throw new Error("Invalid Skill frontmatter");
	}

	return Object.fromEntries(
		match[1].split("\n").map((line) => {
			const separator = line.indexOf(":");
			return [line.slice(0, separator).trim(), line.slice(separator + 1).trim()];
		}),
	);
}

function formatDocument(documentPath, source) {
	return `<document path=${JSON.stringify(documentPath)}>\n${source.trim()}\n</document>`;
}

function relative(root, file) {
	return path.relative(root, file).split(path.sep).join("/");
}

function uniqueStrings(value) {
	if (!Array.isArray(value)) {
		return [];
	}

	return [...new Set(value.filter((item) => typeof item === "string"))];
}
