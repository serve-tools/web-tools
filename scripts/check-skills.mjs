import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const rootPackage = await readJSON(path.join(root, "package.json"));
const errors = [];
const names = new Set();
const publicPackageNames = new Set();
let publicPackages = 0;
let metadataCharacters = 0;

for (const workspace of rootPackage.workspaces) {
	const packageRoot = path.join(root, workspace);
	const packageJSON = await readJSON(path.join(packageRoot, "package.json"));
	const skillDirectories = await listDirectories(path.join(packageRoot, "skills"));

	if (packageJSON.private) {
		if (skillDirectories.length > 0) {
			errors.push(`${workspace}: private workspaces must not contain package Skills`);
		}

		continue;
	}

	publicPackages += 1;
	publicPackageNames.add(packageJSON.name);

	const expectedName = packageJSON.name.replace(/^@/, "").replaceAll("/", "-");

	if (skillDirectories.length !== 1 || skillDirectories[0] !== expectedName) {
		errors.push(`${workspace}: expected exactly skills/${expectedName}`);
		continue;
	}

	if (!Array.isArray(packageJSON.files) || !packageJSON.files.includes("skills")) {
		errors.push(`${workspace}: package.json files must include skills`);
	}

	const skillRoot = path.join(packageRoot, "skills", expectedName);
	const skill = await validateSkill(skillRoot, expectedName, packageJSON.name, errors);

	if (skill !== undefined) {
		metadataCharacters += skill.name.length + skill.description.length;

		if (names.has(skill.name)) {
			errors.push(`${workspace}: duplicate Skill name ${skill.name}`);
		}

		names.add(skill.name);
	}
}

const maintainerSkill = await validateSkill(
	path.join(root, ".agents", "skills", "maintain-serve-tools"),
	"maintain-serve-tools",
	undefined,
	errors,
);

if (maintainerSkill !== undefined) {
	metadataCharacters += maintainerSkill.name.length + maintainerSkill.description.length;

	if (names.has(maintainerSkill.name)) {
		errors.push(`duplicate Skill name ${maintainerSkill.name}`);
	}

	names.add(maintainerSkill.name);
}

await validateReleasePackages(publicPackageNames, errors);

if (publicPackages !== 23) {
	errors.push(`expected 23 public workspaces, found ${publicPackages}`);
}

if (metadataCharacters > 8_000) {
	errors.push(`Skill names and descriptions use ${metadataCharacters} characters; keep them at or below 8000`);
}

if (errors.length > 0) {
	console.error(errors.map((error) => `- ${error}`).join("\n"));
	process.exitCode = 1;
} else {
	console.log(
		`Validated ${publicPackages} package Skills and 1 repository Skill (${metadataCharacters} metadata characters).`,
	);
}

async function validateSkill(skillRoot, expectedName, packageName, validationErrors) {
	let source;

	try {
		source = await readFile(path.join(skillRoot, "SKILL.md"), "utf8");
	} catch {
		validationErrors.push(`${relative(skillRoot)}: missing SKILL.md`);
		return undefined;
	}

	const frontmatterMatch = /^---\n([\s\S]*?)\n---\n/.exec(source);

	if (frontmatterMatch === null) {
		validationErrors.push(`${relative(skillRoot)}: invalid SKILL.md frontmatter`);
		return undefined;
	}

	const fields = new Map();

	for (const line of frontmatterMatch[1].split("\n")) {
		const separator = line.indexOf(":");

		if (separator === -1) {
			validationErrors.push(`${relative(skillRoot)}: invalid frontmatter line ${JSON.stringify(line)}`);
			continue;
		}

		fields.set(line.slice(0, separator).trim(), line.slice(separator + 1).trim());
	}

	const unexpectedFields = [...fields.keys()].filter((field) => field !== "name" && field !== "description");
	const name = fields.get("name") ?? "";
	const description = fields.get("description") ?? "";

	if (unexpectedFields.length > 0) {
		validationErrors.push(`${relative(skillRoot)}: unsupported frontmatter fields ${unexpectedFields.join(", ")}`);
	}

	if (name !== expectedName || path.basename(skillRoot) !== name) {
		validationErrors.push(`${relative(skillRoot)}: Skill name and directory must both be ${expectedName}`);
	}

	if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(name) || name.length > 64) {
		validationErrors.push(`${relative(skillRoot)}: invalid Skill name ${JSON.stringify(name)}`);
	}

	if (description.length === 0 || description.length > 1_024) {
		validationErrors.push(`${relative(skillRoot)}: description must contain 1-1024 characters`);
	}

	if (packageName !== undefined && !description.includes(packageName)) {
		validationErrors.push(`${relative(skillRoot)}: description must name ${packageName}`);
	}

	if (source.includes("TODO") || source.split("\n").length > 120) {
		validationErrors.push(`${relative(skillRoot)}: remove placeholders and keep SKILL.md at or below 120 lines`);
	}

	let openAI;

	try {
		openAI = await readFile(path.join(skillRoot, "agents", "openai.yaml"), "utf8");
	} catch {
		validationErrors.push(`${relative(skillRoot)}: missing agents/openai.yaml`);
		return { name, description };
	}

	const shortDescription = /^\s*short_description: "([^"]+)"$/m.exec(openAI)?.[1] ?? "";

	if (shortDescription.length < 25 || shortDescription.length > 64) {
		validationErrors.push(`${relative(skillRoot)}: short_description must contain 25-64 characters`);
	}

	if (!openAI.includes(`default_prompt: "Use $${name} `)) {
		validationErrors.push(`${relative(skillRoot)}: default_prompt must explicitly invoke $${name}`);
	}

	return { name, description };
}

async function validateReleasePackages(packageNames, validationErrors) {
	const source = await readFile(path.join(root, ".github", "workflows", "release.yml"), "utf8");
	const selectedPackages = [...source.matchAll(/^\s+- "(@serve-tools\/[^"]+)"$/gm)].map((match) => match[1]);
	const uniquePackages = new Set(selectedPackages);

	for (const packageName of packageNames) {
		if (!uniquePackages.has(packageName)) {
			validationErrors.push(`release workflow is missing ${packageName}`);
		}
	}

	for (const packageName of uniquePackages) {
		if (!packageNames.has(packageName)) {
			validationErrors.push(`release workflow contains unknown package ${packageName}`);
		}
	}

	if (selectedPackages.length !== uniquePackages.size) {
		validationErrors.push("release workflow contains duplicate package choices");
	}
}

async function listDirectories(directory) {
	try {
		return (await readdir(directory, { withFileTypes: true }))
			.filter((entry) => entry.isDirectory())
			.map((entry) => entry.name)
			.sort();
	} catch (error) {
		if (error.code === "ENOENT") return [];

		throw error;
	}
}

async function readJSON(file) {
	return JSON.parse(await readFile(file, "utf8"));
}

function relative(file) {
	return path.relative(root, file);
}
