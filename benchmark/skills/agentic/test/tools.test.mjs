import assert from "node:assert/strict";
import test from "node:test";
import { createToolSession } from "../tools.mjs";

const condition = {
	files: { "docs/API.md": "Use an owned connection.\nDispose it." },
	scaffolds: { "recipes/start.ts": "export const value = 1;\n" },
};

test("discovery is virtual and never supplies hidden or host files", async () => {
	const session = createToolSession({ condition, check: async () => ({ compile: true, smoke: true }) });
	assert.deepEqual((await session.call("list_files", { query: "", offset: 0 })).paths, [
		"docs/API.md",
		"recipes/start.ts",
	]);
	assert.equal((await session.call("search", { query: "owned", pathPrefix: "", offset: 0 })).matches[0].line, 1);
	assert.match((await session.call("read_file", { path: "/etc/passwd" })).error, /Unknown virtual path/);
	assert.equal(session.source, "");
});

test("copy and unique replacement reuse code and preserve unrelated text", async () => {
	const session = createToolSession({ condition, check: async () => ({}) });
	await session.call("copy_file", { path: "recipes/start.ts" });
	await session.call("replace_solution", { before: "value = 1", after: "value = 9" });
	assert.equal(session.source, "export const value = 9;\n");
	assert.match((await session.call("replace_solution", { before: "missing", after: "x" })).error, /exactly one/);
});

test("failed public checks remain in the trace and budget cannot be bypassed", async () => {
	let calls = 0;
	const session = createToolSession({
		condition,
		maxChecks: 1,
		check: async () => {
			++calls;
			return { compile: false, smoke: false, feedback: "bad type" };
		},
	});
	await session.call("check", {});
	assert.match((await session.call("check", {})).error, /budget exhausted/);
	assert.equal(calls, 1);
	assert.equal(session.checkResults[0].compile, false);
	assert.equal(session.trace.length, 2);
});
