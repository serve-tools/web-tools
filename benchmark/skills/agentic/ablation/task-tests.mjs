import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { freezeTask, gradeArtifact } from "../grading.mjs";
import { cleanupRuntime } from "../runtime.mjs";
import { tasks } from "./tasks.mjs";

const directory = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(directory, "../../../..");
test.after(cleanupRuntime);

test("24 disclosed tasks cover twelve families and behavior mutations", () => {
	assert.equal(tasks.length, 24);
	assert.equal(new Set(tasks.map((task) => task.id)).size, 24);
	const families = new Set(tasks.map((task) => task.family));
	assert.equal(families.size, 12);
	for (const family of families) {
		assert.equal(tasks.filter((task) => task.family === family).length, 2);
	}
	for (const task of tasks) {
		assert.ok(task.prompt.length > 200, task.id);
		assert.ok(task.mutants.length >= 2, task.id);
		assert.ok(task.requirementMatrix.length > 0, task.id);
		const requirements = new Set(task.requirementMatrix.map((row) => row.id));
		for (const mutant of task.mutants) {
			assert.ok(mutant.before && mutant.after !== mutant.before, `${task.id}/${mutant.id}`);
			assert.ok(mutant.requirementIds.length > 0, `${task.id}/${mutant.id}`);
			for (const id of mutant.requirementIds) {
				assert.ok(requirements.has(id), `${task.id}/${mutant.id}/${id}`);
			}
		}
	}
});

test("both independently authored positive implementations pass every task", async () => {
	for (const task of tasks) {
		const frozen = await freezeTask(task);
		for (const name of ["solution.fixture.ts", "solution.alternate.ts"]) {
			const source = await readFile(path.join(directory, "tasks", task.id, name), "utf8");
			const grade = await gradeArtifact({ root, task: frozen, source, hidden: true });
			assert.ok(
				grade.compile && grade.contracts && grade.smoke && grade.hidden,
				`${task.id}/${name}: ${JSON.stringify(grade)}`,
			);
		}
	}
});

test("every literal behavior mutant compiles, passes public smoke, and fails hidden checks", async () => {
	for (const task of tasks) {
		const frozen = await freezeTask(task);
		const original = await readFile(path.join(directory, "..", task.fixturePath), "utf8");
		for (const mutant of task.mutants) {
			assert.equal(original.split(mutant.before).length, 2, `Unique mutation target: ${task.id}/${mutant.id}`);
			const source = original.replace(mutant.before, mutant.after);
			const grade = await gradeArtifact({ root, task: frozen, source, hidden: true });
			assert.ok(
				grade.compile && grade.contracts && grade.smoke && !grade.hidden,
				`${task.id}/${mutant.id}: ${JSON.stringify(grade)}`,
			);
		}
	}
});
