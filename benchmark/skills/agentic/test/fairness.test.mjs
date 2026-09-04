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

test("inventory import contract accepts the trusted server entrypoint", async () => {
	const task = selectTask("inventory-http-handler");

	assert.deepEqual(task.requiredRuntimeImports[0], [
		"@serve-tools/http-contract",
		"@serve-tools/http-contract/server",
	]);

	const grade = await gradeArtifact({
		root,
		task,
		source: `import { createHandler } from "@serve-tools/http-contract/server";
import { route } from "@serve-tools/router";

export function createInventoryHandler() {
	void createHandler;
	void route;

	return async () => Response.json({ error: "deliberately_incomplete" }, { status: 500 });
}
`,
	});

	assert.equal(grade.compile, true, grade.feedback);
	assert.equal(grade.contracts, true, grade.feedback);
	assert.equal(grade.smoke, false, "incomplete artifact should reach and fail smoke after passing the import gate");
});

test("opaque cursor permits structural encode input while keeping exact decoded payloads", async () => {
	const task = selectTask("opaque-cursor");
	const fixture = await fixtureSource(task);
	const structural = fixture.replace(
		"if (!isRecord(input) || Object.keys(input).length !== 2) {",
		"if (!isRecord(input)) {",
	);

	assert.notEqual(structural, fixture, "cursor fixture mutation target drifted");

	const grade = await gradeArtifact({ root, task, source: structural, hidden: true });

	assert.equal(grade.compile, true, grade.feedback);
	assert.equal(grade.contracts, true, grade.feedback);
	assert.equal(grade.smoke, true, grade.feedback);
	assert.equal(grade.hidden, true, grade.hiddenFeedback);
});

test("inventory hidden checks accept an equivalent reversed Allow method order", async () => {
	const task = selectTask("inventory-http-handler");
	const fixture = await fixtureSource(task);
	const reversed = fixture
		.replace("\treturn createHandler(api, {", "\tconst baseHandler = createHandler(api, {")
		.replace(
			"\t});\n}\n\nfunction schema<T>",
			`\t});

\treturn async (request: Request): Promise<Response> => {
\t\tconst response = await baseHandler(request);

\t\tif (response.status !== 405) return response;

\t\tconst headers = new Headers(response.headers);
\t\theaders.set("allow", "PUT, GET");

\t\treturn new Response(response.body, { status: response.status, headers });
\t};
}

function schema<T>`,
		);

	assert.notEqual(reversed, fixture, "inventory fixture mutation target drifted");

	const grade = await gradeArtifact({ root, task, source: reversed, hidden: true });

	assert.equal(grade.compile, true, grade.feedback);
	assert.equal(grade.contracts, true, grade.feedback);
	assert.equal(grade.smoke, true, grade.feedback);
	assert.equal(grade.hidden, true, grade.hiddenFeedback);
});

function selectTask(id) {
	const task = tasks.find((candidate) => candidate.id === id);

	assert.ok(task, `Missing task ${id}`);

	return task;
}

function fixtureSource(task) {
	return readFile(path.resolve(agentic, task.fixturePath), "utf8");
}
