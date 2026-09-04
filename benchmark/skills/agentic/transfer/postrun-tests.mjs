import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { freezeTask, gradeArtifact } from "../grading.mjs";
import { cleanupRuntime } from "../runtime.mjs";
import { postrunTask } from "./postrun.mjs";
import { tasks } from "./tasks.mjs";

const directory = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(directory, "../../../..");
test.after(cleanupRuntime);

test("exploratory fairness checks accept valid alternative validation delivery and structural records", async () => {
	for (const id of ["preference-handler", "page-operation"]) {
		const task = await freezeTask(tasks.find((task) => task.id === id));
		let source = await readFile(path.join(directory, "..", task.fixturePath), "utf8");
		if (id === "preference-handler") {
			source = source.replace("Object.keys(value).length !== 3 ||", "");
		} else {
			source = source.replace("export function createPageOperation(", "function originalPageOperation(");
			source += `
export function createPageOperation(...args: Parameters<typeof originalPageOperation>) {
	try { return originalPageOperation(...args); }
	catch (error) { return new AsyncOperation(async () => { throw error; }); }
}
`;
		}
		const original = await gradeArtifact({ root, task, source, hidden: true });
		assert.equal(original.compile, true, original.feedback);
		assert.equal(original.smoke && original.hidden, false);
		const corrected = await gradeArtifact({ root, task: postrunTask(structuredClone(task)), source, hidden: true });
		assert.ok(corrected.compile && corrected.smoke && corrected.hidden, JSON.stringify(corrected));
	}
});

test("exploratory link probes retain golden behavior and reject missing positive-id validation", async () => {
	const task = await freezeTask(tasks.find((task) => task.id === "workspace-links"));
	const source = await readFile(path.join(directory, "..", task.fixturePath), "utf8");
	const probe = postrunTask(structuredClone(task), true);
	const golden = await gradeArtifact({ root, task: probe, source, hidden: true });
	assert.ok(golden.compile && golden.smoke && golden.hidden, JSON.stringify(golden));
	const mutant = source.replace("integer <= 0 ||", "");
	const checked = await gradeArtifact({ root, task: probe, source: mutant, hidden: true });
	assert.equal(checked.compile, true, checked.feedback);
	assert.equal(checked.hidden, false);
});
