import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { readWorkspaceInventory } from "../../../../scripts/workspaces.mjs";
import { createConditions } from "../conditions.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../..");

test("conditions snapshot all packages with the same metadata and baseline documentation", async () => {
	const [conditions, inventory] = await Promise.all([createConditions(root), readWorkspaceInventory(root)]);
	const packageNames = inventory.publicWorkspaces
		.map((workspace) => workspace.name)
		.filter((packageName) => packageName !== "@serve-tools/skills")
		.sort();
	const included = packageNamesFromIndex(conditions.docs.files["index/packages.md"]);
	const excluded = conditions.docs.excludedPackages;

	assert.deepEqual(Object.keys(conditions).sort(), ["current", "docs", "minimal"]);
	assert.ok(excluded.every(({ name, reason }) => packageNames.includes(name) && /^missing /.test(reason)));
	assert.deepEqual([...included, ...excluded.map(({ name }) => name)].sort(), packageNames);

	for (const condition of Object.values(conditions)) {
		assert.ok(Object.isFrozen(condition));
		assert.ok(Object.isFrozen(condition.files));
		assert.ok(Object.isFrozen(condition.scaffolds));

		assert.deepEqual(condition.excludedPackages, excluded);

		for (const packageName of included) {
			assert.match(condition.discovery, new RegExp(escapeRegExp(`${packageName}@`)));
		}
	}

	const baselineFiles = pickBaselineFiles(conditions.docs.files);

	assert.ok(Object.keys(baselineFiles).some((filePath) => filePath.endsWith(".d.ts")));
	assert.ok(
		included.every(
			(packageName) => baselineFiles[`packages/${packageName.replace("@serve-tools/", "")}/README.md`],
		),
	);
	assert.deepEqual(baselineFiles, pickBaselineFiles(conditions.current.files));
	assert.deepEqual(baselineFiles, pickBaselineFiles(conditions.minimal.files));
});

test("conditions keep documentation arms separate and make current Skills discoverable", async () => {
	const { current, docs, minimal } = await createConditions(root);

	assert.ok(Object.keys(docs.files).every((filePath) => !filePath.includes("/skills/")));
	assert.ok(Object.keys(current.files).some((filePath) => filePath.endsWith("/SKILL.md")));
	assert.ok(Object.keys(current.files).some((filePath) => filePath.includes("/references/")));
	assert.ok(Object.keys(current.files).includes("suite/skills/serve-tools-skills/SKILL.md"));
	assert.ok(Object.keys(minimal.files).some((filePath) => filePath.endsWith("/skills/router.md")));
	assert.equal(Object.keys(docs.scaffolds).length, 0);
	assert.equal(Object.keys(current.scaffolds).length, 0);
	assert.ok(Object.keys(minimal.scaffolds).every((filePath) => filePath.endsWith("/recipe-quick-start.ts")));
	assert.match(current.files["index/packages.md"], /Skill: packages\//);
	assert.match(minimal.files["index/packages.md"], /Scaffold: packages\//);
	assert.match(current.discovery, /when package selection is unclear/);
	assert.match(minimal.discovery, /when useful; otherwise use the README and declarations/);
	assert.doesNotMatch(minimal.discovery, /before adapting/);
});

test("minimal scaffolds are deterministic public-import extractions from quick-start recipes", async () => {
	const conditions = await createConditions(root);
	const inventory = await readWorkspaceInventory(root);
	const workspaces = new Map(inventory.publicWorkspaces.map((workspace) => [workspace.name, workspace]));

	for (const name of packageNamesFromIndex(conditions.docs.files["index/packages.md"])) {
		const workspace = workspaces.get(name);
		const packageName = name.replace("@serve-tools/", "");
		const skillName = name.replace(/^@/, "").replaceAll("/", "-");
		const recipePath = path.join(
			root,
			workspace.location,
			"skills",
			skillName,
			"references",
			"recipe-quick-start.md",
		);
		const recipe = await readFile(recipePath, "utf8");
		const extracted = /^```ts\n([\s\S]*?)\n```$/m.exec(recipe)?.[1];
		const scaffoldPath = `packages/${packageName}/scaffolds/recipe-quick-start.ts`;

		assert.notEqual(extracted, undefined, recipePath);
		assert.equal(conditions.minimal.scaffolds[scaffoldPath], `${extracted}\n`);
		assert.doesNotMatch(conditions.minimal.scaffolds[scaffoldPath], /["']\.\.\/src\//);
	}
});

test("condition hashes reproduce their frozen content", async () => {
	const conditions = await createConditions(root);

	for (const condition of Object.values(conditions)) {
		assert.match(condition.sha256, /^[a-f0-9]{64}$/);
		assert.equal(condition.sha256, hashCondition(condition));
	}

	const again = await createConditions(root);

	for (const id of Object.keys(conditions)) {
		assert.equal(conditions[id].sha256, again[id].sha256);
	}
});

function pickBaselineFiles(files) {
	return Object.fromEntries(
		Object.entries(files).filter(
			([filePath]) => filePath !== "index/packages.md" && !filePath.includes("/skills/"),
		),
	);
}

function hashCondition({ discovery, excludedPackages, files, id, scaffolds }) {
	const hash = createHash("sha256");

	for (const [path, source] of [
		["id", id],
		["discovery", discovery],
		["excludedPackages", JSON.stringify(excludedPackages)],
		...Object.entries(files).map(([filePath, source]) => [`files/${filePath}`, source]),
		...Object.entries(scaffolds).map(([scaffoldPath, source]) => [`scaffolds/${scaffoldPath}`, source]),
	]) {
		hash.update(path);
		hash.update("\0");
		hash.update(source);
		hash.update("\0");
	}

	return hash.digest("hex");
}

function packageNamesFromIndex(index) {
	return [...index.matchAll(/^- (@serve-tools\/[^@]+)@/gm)].map((match) => match[1]);
}

function escapeRegExp(value) {
	return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
