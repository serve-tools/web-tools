import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { auditSaved } from "./saved-audit.mjs";

const validationHelper = `
async function acceptsTypeError(create) {
	let operation;
	try { operation = create(); }
	catch (error) { assert.ok(error instanceof TypeError); return; }
	let timer;
	try {
		await assert.rejects(Promise.race([
			operation.result,
			new Promise((_, reject) => { timer = setTimeout(() => reject(new Error("validation timed out")), 500); }),
		]), TypeError);
		await operation.finished;
	} finally { clearTimeout(timer); }
}
`;

/** Explicit post-run sensitivity check; never substitutes for the frozen endpoint. */
export function postrunTask(task, quality = false) {
	if (task.id === "preference-handler") {
		const target = '\t[{ userId: 1, key: "theme", value: null, extra: true }],\n';
		assert.ok(task.programs.hidden.includes(target));
		task.programs.hidden = task.programs.hidden.replace(target, "");
		return task;
	}
	if (task.id === "page-operation") {
		for (const phase of ["smoke", "hidden"]) {
			const pattern = /^assert\.throws\(\(\) => (createPageOperation\(.*\)), TypeError\);$/gm;
			assert.equal([...task.programs[phase].matchAll(pattern)].length, phase === "smoke" ? 2 : 6);
			task.programs[phase] =
				`${task.programs[phase].replace(pattern, "await acceptsTypeError(() => $1);")}${validationHelper}`;
		}
		return task;
	}
	if (quality && task.id === "workspace-links") {
		const target = "const { createWorkspaceLinks } = await loadSolution();";
		assert.ok(task.programs.hidden.includes(target));
		task.programs.hidden = task.programs.hidden.replace(
			target,
			`const originalURLPattern = Object.getOwnPropertyDescriptor(globalThis, "URLPattern");
${target}
assert.deepEqual(Object.getOwnPropertyDescriptor(globalThis, "URLPattern"), originalURLPattern, "artifact must preserve global URLPattern");`,
		);
		task.programs.hidden += `
for (const href of ["/teams/0/boards/1", "/teams/-1/boards/1", "/teams/1/boards/0", "/teams/1/boards/-1", "/teams/0/invite/x", "/teams/-1/invite/x"]) {
	assert.equal(links.inspect(href), null, "matched ids must be positive");
}
`;
		return task;
	}
	return null;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
	const input = process.argv[2];
	assert.ok(input, "Supply the original evidence directory.");
	for (const name of ["fairness", "quality"]) {
		const { report, checked } = await auditSaved(input, name, (task) => postrunTask(task, name === "quality"));
		process.stdout.write(
			`${name}: ${JSON.stringify(report.conditions.map(({ variant, successes, attempts }) => ({ variant, successes, attempts })))}\n`,
		);
		process.stdout.write(
			`Changed final outcomes: ${checked.filter((record) => Object.hasOwn(record, "originalPass") && record.originalPass !== record.pass).length}\n`,
		);
	}
}
