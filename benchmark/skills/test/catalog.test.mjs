import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { createDiscoveryContext, loadCatalog, normalizeRoute } from "../lib/catalog.mjs";
import { tasks } from "../tasks.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

test("catalog discovers every runtime package Skill", async () => {
	const catalog = await loadCatalog(root);

	assert.equal(catalog.packages.length, 65);
	assert.equal(new Set(catalog.packages.map((packageEntry) => packageEntry.name)).size, 65);

	assert.ok(catalog.packages.every((packageEntry) => packageEntry.references.length > 0));
	assert.ok(!catalog.packages.some((packageEntry) => packageEntry.name === "@serve-tools/skills"));
});

test("package-selection guide names every runtime package", async () => {
	const catalog = await loadCatalog(root);
	const guide = await readFile(
		path.join(root, "suite/skills/serve-tools-skills/references/package-selection.md"),
		"utf8",
	);

	for (const packageEntry of catalog.packages) {
		assert.ok(guide.includes(packageEntry.name), packageEntry.name);
	}
});

test("baseline and Skill discovery contexts expose different documentation conditions", async () => {
	const catalog = await loadCatalog(root);
	const baseline = await createDiscoveryContext(catalog, "baseline");
	const skill = await createDiscoveryContext(catalog, "skill");

	assert.match(baseline, /installed README documents/);

	assert.doesNotMatch(baseline, /references\/package-selection\.md/);

	assert.match(skill, /references\/package-selection\.md/);
	assert.match(skill, /Package Skill discovery metadata/);

	assert.doesNotMatch(skill, /client\/websocket\/skills\/[^/]+\/references\/recipe-/);
});

test("route normalization rejects unknown packages and documents", async () => {
	const catalog = await loadCatalog(root);

	const route = normalizeRoute(
		catalog,
		{
			documents: ["../../secret", "client/websocket/README.md"],
			packages: ["@serve-tools/client-websocket", "@serve-tools/not-real"],
			rationale: "test",
		},
		"baseline",
	);

	assert.deepEqual(route.packages, ["@serve-tools/client-websocket"]);
	assert.deepEqual(route.documents, ["client/websocket/README.md"]);
});

test("corpus covers every runtime package and every evaluation kind", async () => {
	const catalog = await loadCatalog(root);
	const taskIDs = new Set(tasks.map((task) => task.id));

	const selectionPackages = new Set(
		tasks.filter((task) => task.kind === "selection").flatMap((task) => task.expected.packages),
	);

	assert.equal(taskIDs.size, tasks.length);

	assert.deepEqual([...new Set(tasks.map((task) => task.kind))].sort(), ["composition", "selection", "usage"]);
	assert.deepEqual(
		[...selectionPackages].sort(),
		catalog.packages.map((packageEntry) => packageEntry.name),
	);

	assert.ok(tasks.some((task) => task.source === "reve-core-inspired"));
});

test("every runtime package has one exact public usage recipe and Skill reference", async () => {
	const catalog = await loadCatalog(root);
	const usageTasks = tasks.filter((task) => task.kind === "usage");
	const usageByPackage = new Map();

	for (const task of usageTasks) {
		assert.ok(task.goldenRecipe, `${task.id} needs a public golden recipe`);
		assert.match(task.goldenRecipe, /\/test\/[^/]+\.recipes\.ts$/, `${task.id} must use a recipe fixture`);
		assert.ok(task.expected.codeTerms.length > 0, `${task.id} needs semantic code terms`);
		assert.ok(task.expected.documentSuffixes.length > 0, `${task.id} needs a package recipe reference`);
		assert.ok(
			task.expected.documentSuffixes.some((reference) => reference.includes("/references/recipe-")),
			`${task.id} must route to its package-specific recipe reference`,
		);

		const primaryPackage = task.expected.packages[0];
		const packageTasks = usageByPackage.get(primaryPackage) ?? [];

		packageTasks.push(task);
		usageByPackage.set(primaryPackage, packageTasks);
	}

	for (const packageEntry of catalog.packages) {
		const packageTasks = usageByPackage.get(packageEntry.name) ?? [];

		assert.equal(packageTasks.length, 1, `${packageEntry.name} must have exactly one primary usage task`);

		const [task] = packageTasks;

		assert.ok(
			task.goldenRecipe.startsWith(`${packageEntry.workspace}/test/`),
			`${task.id} must use ${packageEntry.name}'s own compile fixture`,
		);
		assert.ok(
			task.expected.documentSuffixes.some((reference) =>
				reference.startsWith(`${packageEntry.workspace}/skills/${packageEntry.skillName}/references/recipe-`),
			),
			`${task.id} must use ${packageEntry.name}'s exact recipe reference`,
		);
	}
});
