import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { promisify } from "node:util";

const execute = promisify(execFile);
const root = path.resolve(import.meta.dirname, "../../..");

test("runner bounds fixture jobs and keeps paired records sorted", async () => {
	const temporaryRoot = await mkdtemp(path.join(tmpdir(), "serve-tools-skill-benchmark-"));
	const output = path.join(temporaryRoot, "report");

	try {
		await execute(
			process.execPath,
			[
				"benchmark/skills/run.mjs",
				"--provider",
				"fixture",
				"--no-compile",
				"--quiet",
				"--task",
				"indexeddb-direct-operations",
				"--runs",
				"2",
				"--concurrency",
				"4",
				"--output",
				output,
			],
			{ cwd: root },
		);

		const report = JSON.parse(await readFile(`${output}.json`, "utf8"));

		assert.equal(report.records.length, 4);
		assert.deepEqual(
			report.records.map(({ run, taskId, variant }) => ({ run, taskId, variant })),
			[
				{ run: 1, taskId: "indexeddb-direct-operations", variant: "baseline" },
				{ run: 1, taskId: "indexeddb-direct-operations", variant: "skill" },
				{ run: 2, taskId: "indexeddb-direct-operations", variant: "baseline" },
				{ run: 2, taskId: "indexeddb-direct-operations", variant: "skill" },
			],
		);
		assert.ok(report.records.every((record) => record.grade.pass));
	} finally {
		await rm(temporaryRoot, { force: true, recursive: true });
	}
});

test("runner rejects an invalid concurrency", async () => {
	await assert.rejects(
		execute(process.execPath, ["benchmark/skills/run.mjs", "--concurrency", "0"], { cwd: root }),
		/--concurrency must be a positive integer/,
	);
});

test("runner loads the exact compile-checked recipe without document routing", async () => {
	const temporaryRoot = await mkdtemp(path.join(tmpdir(), "serve-tools-skill-benchmark-"));
	const output = path.join(temporaryRoot, "report");

	try {
		await execute(
			process.execPath,
			[
				"benchmark/skills/run.mjs",
				"--provider",
				"fixture",
				"--no-compile",
				"--quiet",
				"--task",
				"client-db-transaction",
				"--variants",
				"skill",
				"--output",
				output,
			],
			{ cwd: root },
		);

		const report = JSON.parse(await readFile(`${output}.json`, "utf8"));
		const [record] = report.records;

		assert.equal(record.metrics.requests, 0);
		assert.deepEqual(record.route.documents, [
			"client/db/skills/serve-tools-client-db/SKILL.md",
			"client/db/skills/serve-tools-client-db/references/recipe-quick-start.md",
		]);
		assert.equal(record.grade.pass, true);
	} finally {
		await rm(temporaryRoot, { force: true, recursive: true });
	}
});
