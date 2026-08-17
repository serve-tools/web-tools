import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { createDiscoveryContext, loadCatalog, normalizeRoute } from "../lib/catalog.mjs";
import { tasks } from "../tasks.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

test("catalog discovers every runtime package Skill", async () => {
	const catalog = await loadCatalog(root);

	assert.equal(catalog.packages.length, 52);
	assert.equal(new Set(catalog.packages.map((packageEntry) => packageEntry.name)).size, 52);
	assert.ok(catalog.packages.every((packageEntry) => packageEntry.references.length > 0));
	assert.ok(!catalog.packages.some((packageEntry) => packageEntry.name === "@serve-tools/skills"));
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
