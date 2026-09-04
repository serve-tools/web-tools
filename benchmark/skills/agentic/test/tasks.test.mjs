import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { gradeArtifact } from "../grading.mjs";
import { tasks } from "../tasks.mjs";

const directory = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(directory, "../../../..");
const agentic = path.dirname(directory);

test("task catalog exposes eight bounded standalone artifact contracts", async () => {
	assert.equal(tasks.length, 8);
	assert.equal(new Set(tasks.map((task) => task.id)).size, tasks.length);

	for (const task of tasks) {
		assert.match(task.id, /^[a-z][a-z0-9-]+$/);
		assert.ok(task.title.length > 0);
		assert.match(task.prompt, /single solution\.ts module/);
		assert.ok(task.packages.length > 0);
		assert.equal(new Set(task.packages).size, task.packages.length);
		assert.ok(task.requiredRuntimeImports.length > 0);
		assert.ok(task.requiredRuntimeImports.every((alternatives) => alternatives.length > 0));
		assert.ok(task.requiredRuntimeImports.flat().every((specifier) => specifier.startsWith("@serve-tools/")));

		for (const key of ["smokePath", "hiddenPath", "fixturePath"]) {
			assert.equal(path.isAbsolute(task[key]), false);
			assert.doesNotMatch(task[key], /(?:^|\/)\.\.(?:\/|$)/);
			assert.ok((await readFile(path.resolve(agentic, task[key]), "utf8")).length > 0);
		}
	}
});

test("golden fixtures compile and pass public and hidden behavior", async () => {
	const grades = await Promise.all(
		tasks.map(async (task) => {
			const source = await readFile(path.resolve(agentic, task.fixturePath), "utf8");

			return [task.id, await gradeArtifact({ root, task, source, hidden: true })];
		}),
	);

	for (const [id, grade] of grades) {
		assert.equal(grade.compile, true, `${id}: ${grade.feedback}`);
		assert.equal(grade.smoke, true, `${id}: ${grade.feedback}`);
		assert.equal(grade.hidden, true, `${id}: ${grade.hiddenFeedback}`);
	}
});

test("hidden checks reject compiling semantic mutations that pass public smoke", async () => {
	const mutations = [
		[
			"opaque-cursor",
			'if (toBase64(bytes, { alphabet: "base64url", omitPadding: true }) !== token) {',
			"if (token.length < 0) {",
		],
		["resource-scope", "throw failure === none ? error : appendSuppressed(error, failure);", "throw error;"],
		[
			"deferred-projection",
			"settings.enabled ? items.slice(0, settings.limit).map((value) => value ** 2) : [];",
			"settings.enabled\n\t\t\t? items.slice(0, settings.limit).map((value) => value ** 2)\n\t\t\t: items.slice(0, settings.limit).filter(() => false);",
		],
	];
	const grades = await Promise.all(
		mutations.map(async ([id, before, after]) => {
			const task = tasks.find((candidate) => candidate.id === id);
			const fixture = await readFile(path.resolve(agentic, task.fixturePath), "utf8");

			assert.ok(fixture.includes(before), `${id}: mutation target drifted`);

			return [id, await gradeArtifact({ root, task, source: fixture.replace(before, after), hidden: true })];
		}),
	);

	for (const [id, grade] of grades) {
		assert.equal(grade.compile, true, `${id}: ${grade.feedback}`);
		assert.equal(grade.smoke, true, `${id}: mutation must reach hidden evaluation: ${grade.feedback}`);
		assert.equal(grade.hidden, false, `${id}: hidden checks accepted a known semantic regression`);
	}
});
