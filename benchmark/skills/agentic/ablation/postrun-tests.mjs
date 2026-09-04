import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { freezeTask, gradeArtifact } from "../grading.mjs";
import { cleanupRuntime } from "../runtime.mjs";
import { postrunTask } from "./postrun.mjs";
import { tasks } from "./tasks.mjs";

test.after(cleanupRuntime);

async function fixture(id) {
	const task = await freezeTask(tasks.find((task) => task.id === id));
	const source = await readFile(path.join("benchmark/skills/agentic", task.fixturePath), "utf8");
	return { task, source };
}

async function check(task, source, expected) {
	const grade = await gradeArtifact({ root: process.cwd(), task, source, hidden: true });
	assert.ok(grade.compile && grade.contracts && grade.smoke, `${task.id}: ${JSON.stringify(grade)}`);
	assert.equal(grade.hidden, expected, `${task.id}: ${JSON.stringify(grade)}`);
}

test("exploratory fairness programs accept valid error, cancellation, pipeline, and init alternatives", async () => {
	const protocol = await fixture("protocol-framed-audit");
	const genericError = protocol.source.replaceAll("new TypeError(", "new Error(");
	await check(protocol.task, genericError, false);
	await check(postrunTask(protocol.task), genericError, true);

	const receipts = await fixture("observable-cold-receipts");
	const synchronousValidation =
		receipts.source.replace("export async function collectReceipts(", "async function collectReceiptsImpl(") +
		`
export function collectReceipts(...args: Parameters<typeof collectReceiptsImpl>) {
 if (typeof args[0] !== 'function' || typeof args[1] !== 'function') throw new Error('callbacks');
 return collectReceiptsImpl(...args);
}
`;
	await check(receipts.task, synchronousValidation, false);
	await check(postrunTask(receipts.task), synchronousValidation, true);

	const events = await fixture("observable-event-cancellation");
	const early = events.source.replace(
		"const controller = new AbortController();",
		"const controller = new AbortController(); if(signal.aborted) { controller.abort(signal.reason); return {seen, stop:()=>controller.abort()}; }",
	);
	const mapped = events.source.replace(
		'when(target, "note").subscribe((event) => seen.push(String((event as CustomEvent).detail)), {',
		'when(target, "note").map((event) => String((event as CustomEvent).detail)).subscribe((value) => seen.push(value), {',
	);
	assert.notEqual(mapped, events.source);
	for (const source of [early, mapped]) {
		await check(events.task, source, false);
		await check(postrunTask(events.task), source, true);
	}

	const ping = await fixture("fixed-ping-client");
	const arrayInit = ping.source.replace(" || Array.isArray(init)", "");
	assert.notEqual(arrayInit, ping.source);
	await check(ping.task, arrayInit, false);
	await check(postrunTask(ping.task), arrayInit, true);
});

test("exploratory quality probes catch concrete enum, chunk-container, and UTF-8 omissions", async () => {
	const status = await fixture("etag-status-handler");
	const unboundedRoute = status.source.replace('codec.enum("api", "worker")', "codec.string() as never");
	await check(status.task, unboundedRoute, true);
	await check(postrunTask(status.task, true), unboundedRoute, false);
	await check(postrunTask(status.task, true), status.source, true);

	const protocol = await fixture("protocol-framed-audit");
	const arrayLike = protocol.source.replace(
		"if (!Array.isArray(chunks))",
		"if (chunks.length === 0) return [];\n\tif (!Array.isArray(chunks))",
	);
	await check(postrunTask(protocol.task), arrayLike, true);
	await check(postrunTask(protocol.task, true), arrayLike, false);
	await check(postrunTask(protocol.task, true), protocol.source, true);

	const target = await fixture("request-target-inspector");
	const valid = target.source.replace(
		"const match = releases.match(url);",
		"decodeURIComponent(url.pathname); decodeURIComponent(url.search);\n\t\tconst match = releases.match(url);",
	);
	await check(target.task, target.source, true);
	await check(postrunTask(target.task, true), target.source, false);
	await check(postrunTask(target.task, true), valid, true);
});
