import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { freezeTask, gradeArtifact } from "../grading.mjs";
import { cleanupRuntime, prepareRuntime } from "../runtime.mjs";
import { tasks } from "./tasks.mjs";

const directory = path.dirname(fileURLToPath(import.meta.url));
const agentic = path.dirname(directory);
const root = path.resolve(agentic, "../../..");

const mutants = [
	mutant(
		"workspace-links",
		"route-positive-mutant",
		"!Number.isSafeInteger(integer) || integer <= 0 || String(integer) !== value",
		"!Number.isFinite(integer) || integer <= 0 || String(integer) !== value",
	),
	mutant(
		"workspace-links",
		"route-default-mutant",
		"const input = withoutDefaults(kind, { params: match.params, search: match.search }) as never;",
		'const input = withoutDefaults(kind, { params: match.params, search: kind === "board" ? { ...match.search, focus: undefined } : match.search }) as never;',
	),
	mutant(
		"page-operation",
		"operation-page-mutant",
		"!Number.isSafeInteger(page) || page <= 0",
		"!Number.isFinite(page) || page <= 0",
	),
	mutant(
		"page-operation",
		"operation-backpressure-mutant",
		"strategy: new CountQueuingStrategy({ highWaterMark })",
		"strategy: new CountQueuingStrategy({ highWaterMark: 100 })",
	),
	mutant("page-operation", "operation-total-mutant", "records += count;", "records += count === 0 ? 1 : count;"),
	mutant(
		"page-operation",
		"operation-cancel-mutant",
		"signal: options.signal, strategy: new CountQueuingStrategy({ highWaterMark })",
		"signal: undefined, strategy: new CountQueuingStrategy({ highWaterMark })",
	),
	mutant(
		"preference-handler",
		"http-body-mutant",
		'Object.keys(value).length !== 1 ||\n\t\t!Object.hasOwn(value, "value") ||\n',
		'false ||\n\t\t!Object.hasOwn(value, "value") ||\n',
	),
	mutant("preference-handler", "http-limit-mutant", "maxBodyBytes: 128", "maxBodyBytes: 1024"),
	mutant(
		"preference-handler",
		"http-delete-mutant",
		': { status: 404, body: { error: "not_found" } },\n\t\t},\n\t});',
		": { status: 204 },\n\t\t},\n\t});",
	),
	mutant(
		"preference-handler",
		"http-clone-mutant",
		"preferences.set(storageKey(record.userId, record.key), record.value);",
		"if (!preferences.has(storageKey(record.userId, record.key))) preferences.set(storageKey(record.userId, record.key), record.value);",
	),
	mutant(
		"reactive-cart",
		"cart-sparse-mutant",
		"return Array.from(value, (record) => {",
		"return Array.from(value).filter(Boolean).map((record) => {",
	),
	mutant("reactive-cart", "cart-tax-mutant", "taxed.has(id) === isTaxed", "true"),
	mutant("reactive-cart", "cart-dispose-mutant", "dispose: stop", "dispose: () => {}"),
	mutant(
		"blob-channel",
		"blob-view-mutant",
		"blobs.set(input.key, input.bytes.slice());",
		"blobs.set(input.key, input.bytes.byteLength === 0 ? new Uint8Array([0]) : input.bytes.slice());",
	),
	mutant(
		"blob-channel",
		"blob-validation-mutant",
		'typeof key !== "string" || key.length === 0 || !(bytes instanceof Uint8Array)',
		'typeof key !== "string" || !(bytes instanceof Uint8Array)',
		{ last: true },
	),
	mutant(
		"blob-channel",
		"blob-duplicate-mutant",
		"blobs.set(key, bytes.slice());",
		"if (!blobs.has(key)) blobs.set(key, bytes.slice());",
	),
	mutant(
		"blob-channel",
		"blob-close-mutant",
		"client.close(reason);",
		"if (reason === undefined) client.close(reason);",
	),
	mutant(
		"binary-packet",
		"packet-endian-mutant",
		"setUint32(1, payload.byteLength, false)",
		"setUint32(1, payload.byteLength, payload.byteLength >= 256)",
	),
	mutant(
		"binary-packet",
		"packet-canonical-mutant",
		'toBase64(packet, { alphabet: "base64url", omitPadding: true }) !== token',
		"false",
	),
	mutant("binary-packet", "packet-length-mutant", "const maximumLength = 65_535;", "const maximumLength = 65_536;"),
	mutant("binary-packet", "packet-version-mutant", "if (packet[0] !== 1)", "if (packet[0] !== 1 && packet[0] !== 2)"),
	mutant("resource-lease", "lease-rollback-mutant", "await stack.disposeAsync();", "await Promise.resolve();"),
	mutant("resource-lease", "lease-suppression-mutant", "throw appendSuppressed(cleanup, failure);", "throw cleanup;"),
	mutant(
		"switchable-projection",
		"projection-sparse-mutant",
		"return Array.from(value, (item) => {",
		"return Array.from(value).filter((item) => item !== undefined).map((item) => {",
	),
	mutant("switchable-projection", "projection-disabled-mutant", ": [];", ": items.slice(0, 0);"),
	mutant(
		"switchable-projection",
		"projection-restart-mutant",
		"active?.dispose();",
		"if (settings.offset !== 1) active?.dispose();",
	),
	mutant("switchable-projection", "projection-dispose-mutant", "disposed = true;", "disposed = false;"),
];

test.after(cleanupRuntime);

test("transfer catalog and requirement matrices are complete", async () => {
	assert.equal(tasks.length, 8);
	assert.equal(new Set(tasks.map((task) => task.id)).size, tasks.length);

	const mutantIds = new Set(mutants.map((entry) => entry.id));
	assert.equal(mutantIds.size, mutants.length);

	for (const task of tasks) {
		assert.match(task.id, /^[a-z][a-z0-9-]+$/);
		assert.match(task.prompt, /single solution\.ts module/);
		assert.ok(task.requirementMatrix.length >= 4);
		const taskMutants = mutants.filter((entry) => entry.taskId === task.id);
		assert.ok(taskMutants.length >= 2 && taskMutants.length <= 4);

		for (const key of ["smokePath", "hiddenPath", "fixturePath"]) {
			assert.match(task[key], new RegExp(`^transfer/tasks/${task.id}/`));
			assert.ok((await readFile(path.resolve(agentic, task[key]), "utf8")).length > 0);
		}

		for (const row of task.requirementMatrix) {
			assert.ok(row.requirement.length > 0);
			assert.ok(row.disclosedInputs.length > 0);
			assert.match(row.oracle, /^(?:example|property|interaction|boundary|identity|timing)$/);
			assert.match(row.visibility, /^(?:smoke|hidden|smoke\+hidden)$/);
			assert.ok(row.testBlock.length > 0);
			assert.equal(typeof row.critical, "boolean");
			assert.ok(row.mutantIds.every((id) => mutantIds.has(id)));
			if (row.critical) {
				assert.ok(row.mutantIds.length > 0, `${task.id}: ${row.requirement} needs a mapped mutant`);
			}
		}
	}
});

test("golden transfer fixtures pass frozen public and hidden checks", async () => {
	const runtime = await prepareRuntime(root);

	for (const declared of tasks) {
		const task = await freezeTask(declared);
		const source = await readFile(path.resolve(agentic, task.fixturePath), "utf8");
		const grade = await gradeArtifact({ root, task, source, hidden: true, runtime, timeoutMs: 15_000 });

		assert.equal(grade.compile, true, `${task.id}: ${grade.feedback}`);
		assert.equal(grade.contracts, true, `${task.id}: ${grade.feedback}`);
		assert.equal(grade.smoke, true, `${task.id}: ${grade.feedback}`);
		assert.equal(grade.hidden, true, `${task.id}: ${grade.hiddenFeedback}`);
		assert.ok(Object.isFrozen(task.programs));
	}
});

test("hidden checks reject every compiling smoke-passing semantic mutant", async () => {
	const runtime = await prepareRuntime(root);

	for (const entry of mutants) {
		const declared = tasks.find((task) => task.id === entry.taskId);
		const task = await freezeTask(declared);
		const fixture = await readFile(path.resolve(agentic, task.fixturePath), "utf8");
		const source = replaceFixture(fixture, entry);
		const grade = await gradeArtifact({ root, task, source, hidden: true, runtime, timeoutMs: 15_000 });

		assert.equal(grade.compile, true, `${entry.id}: ${grade.feedback}`);
		assert.equal(grade.smoke, true, `${entry.id}: mutant did not reach hidden checks: ${grade.feedback}`);
		assert.equal(grade.hidden, false, `${entry.id}: hidden checks accepted a semantic regression`);
	}
});

function mutant(taskId, id, before, after, options = {}) {
	return { taskId, id, before, after, ...options };
}

function replaceFixture(source, entry) {
	const index = entry.last ? source.lastIndexOf(entry.before) : source.indexOf(entry.before);

	assert.notEqual(index, -1, `${entry.id}: mutation target drifted`);

	return `${source.slice(0, index)}${entry.after}${source.slice(index + entry.before.length)}`;
}
