import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { freezeTask, gradeArtifact } from "../grading.mjs";
import { cleanupRuntime, prepareRuntime } from "../runtime.mjs";
import { tasks } from "../tasks.mjs";

const directory = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(directory, "../../../..");

test.after(cleanupRuntime);

test("validator executes fixtures from the frozen runtime", async () => {
	const task = await freezeTask(tasks.find((candidate) => candidate.id === "opaque-cursor"));
	const source = await readFile(path.resolve(path.dirname(directory), task.fixturePath), "utf8");
	const runtime = await prepareRuntime(root);
	const grade = await gradeArtifact({ root, task, source, hidden: true });

	assert.equal(grade.compile, true, grade.feedback);
	assert.equal(grade.contracts, true, grade.feedback);
	assert.equal(grade.smoke, true, grade.feedback);
	assert.equal(grade.hidden, true, grade.hiddenFeedback);
	assert.ok(Object.isFrozen(task.programs));
	assert.ok(runtime.directory.startsWith(`${process.platform === "darwin" ? "/private/tmp" : os.tmpdir()}/`));
	assert.doesNotMatch(runtime.nodeModules, new RegExp(root.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
});

test("artifact cannot read the trusted hidden check or repository sources", async () => {
	const task = tasks.find((candidate) => candidate.id === "opaque-cursor");
	const fixture = await readFile(path.resolve(path.dirname(directory), task.fixturePath), "utf8");
	const hidden = path.resolve(path.dirname(directory), task.hiddenPath);
	const source = [
		`import { readFileSync } from "node:fs";`,
		`try { readFileSync(${JSON.stringify(hidden)}, "utf8"); throw new Error("hidden test leaked"); } catch (error) { if (error instanceof Error && error.message === "hidden test leaked") throw error; }`,
		fixture,
	].join("\n");
	const grade = await gradeArtifact({ root, task, source, hidden: true });

	assert.equal(grade.compile, true, grade.feedback);
	assert.equal(grade.smoke, true, grade.feedback);
	assert.equal(grade.hidden, true, grade.hiddenFeedback);
});
