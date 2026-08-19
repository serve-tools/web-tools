import { readFile, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const rootPackage = await readJSON(path.join(root, "package.json"));
const solutionPath = path.join(root, "tsconfig.build.json");
const solution = await readJSON(solutionPath);
const targets = new Set([path.join(root, "tsconfig.build.tsbuildinfo")]);
const visitedConfigs = new Set();

for (const reference of solution.references) {
	await addProject(path.resolve(path.dirname(solutionPath), reference.path));
}

for (const workspace of rootPackage.workspaces) {
	const workspaceRoot = path.join(root, workspace);
	const packageJSON = await readJSON(path.join(workspaceRoot, "package.json"));

	if (packageJSON.scripts?.["build:bundle"] !== undefined) {
		addTarget(path.join(workspaceRoot, "dist"));
		addTarget(path.join(workspaceRoot, "tsconfig.tsbuildinfo"));
	}
}

await Promise.all([...targets].map((target) => rm(target, { force: true, recursive: true })));

async function addProject(referencePath) {
	const configPath =
		path.extname(referencePath) === ".json" ? referencePath : path.join(referencePath, "tsconfig.json");

	if (visitedConfigs.has(configPath)) {
		return;
	}

	visitedConfigs.add(configPath);

	const config = await readJSON(configPath);
	const configRoot = path.dirname(configPath);
	const outDir = config.compilerOptions?.outDir;
	const buildInfo = config.compilerOptions?.tsBuildInfoFile ?? `${path.basename(configPath, ".json")}.tsbuildinfo`;

	if (outDir !== undefined) {
		addTarget(path.resolve(configRoot, outDir));
	}

	addTarget(path.resolve(configRoot, buildInfo));

	for (const reference of config.references ?? []) {
		await addProject(path.resolve(configRoot, reference.path));
	}
}

function addTarget(target) {
	const relative = path.relative(root, target);

	if (relative === "" || relative.startsWith("..") || path.isAbsolute(relative)) {
		throw new Error(`Refusing to clean path outside the repository: ${target}`);
	}

	targets.add(target);
}

async function readJSON(file) {
	return JSON.parse(await readFile(file, "utf8"));
}
