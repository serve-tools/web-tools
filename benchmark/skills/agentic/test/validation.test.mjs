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

test("batch hidden checks reject nullish defaulting of an explicit null capacity", async () => {
	const task = selectTask("batch-operation");
	const fixture = await fixtureSource(task);
	const mutation = fixture.replace(
		"const highWaterMark = options.highWaterMark === undefined ? 0 : options.highWaterMark;",
		"const highWaterMark = options.highWaterMark ?? 0;",
	);

	assert.notEqual(mutation, fixture, "batch fixture mutation target drifted");

	const grade = await gradeArtifact({ root, task, source: mutation, hidden: true });

	assert.equal(grade.compile, true, grade.feedback);
	assert.equal(grade.contracts, true, grade.feedback);
	assert.equal(grade.smoke, true, grade.feedback);
	assert.equal(grade.hidden, false, "hidden checks accepted highWaterMark: null");
});

test("projection hidden checks reject sparse-array validation that skips holes", async () => {
	const task = selectTask("deferred-projection");
	const fixture = await fixtureSource(task);
	const correct = `\tconst items = Array.from(value, (item) => {
\t\tif (typeof item !== "number" || !Number.isFinite(item)) {
\t\t\tthrow new TypeError("Expected finite items");
\t\t}

\t\treturn item;
\t});`;
	const skipping = `\tconst items = Array.isArray(value) ? value.slice() : Array.from(value);

\tif (items.some((item) => typeof item !== "number" || !Number.isFinite(item))) {
\t\tthrow new TypeError("Expected finite items");
\t}`;
	const mutation = fixture.replace(correct, skipping);

	assert.notEqual(mutation, fixture, "projection fixture mutation target drifted");

	const grade = await gradeArtifact({ root, task, source: mutation, hidden: true });

	assert.equal(grade.compile, true, grade.feedback);
	assert.equal(grade.contracts, true, grade.feedback);
	assert.equal(grade.smoke, true, grade.feedback);
	assert.equal(grade.hidden, false, "hidden checks accepted sparse arrays with skipped holes");
});

function selectTask(id) {
	const task = tasks.find((candidate) => candidate.id === id);

	assert.ok(task, `Missing task ${id}`);

	return task;
}

function fixtureSource(task) {
	return readFile(path.resolve(agentic, task.fixturePath), "utf8");
}
