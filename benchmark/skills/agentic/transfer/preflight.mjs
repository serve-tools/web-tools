import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { freezeTask, runProcess } from "../grading.mjs";
import { filesUnder, runtimeFingerprint } from "../snapshot.mjs";

const directory = path.dirname(fileURLToPath(import.meta.url));
const agentic = path.dirname(directory);
const root = path.resolve(agentic, "../../..");
const destination = path.join(directory, "preflight.json");
const settings = {
	model: "gpt-5.6-luna",
	effort: "low",
	suite: "transfer",
	runs: 5,
	seeds: [7349, 9811],
	concurrency: 6,
	timeoutMs: 240_000,
	maxActions: 32,
	maxChecks: 4,
	variants: ["docs", "current", "minimal"],
	taskIds: [],
};

/** Refuse live measurement when frozen inputs, settings, or the preflight evidence changed. */
export async function verifyPreflight({ conditions, tasks, options }) {
	const saved = JSON.parse(await readFile(destination, "utf8"));
	assert.equal(saved.status, "ready", "Complete the transfer preflight before a live run.");
	for (const [key, value] of Object.entries(settings)) {
		assert.deepEqual(options[key], value, `Transfer protocol setting mismatch: ${key}`);
	}
	assert.deepEqual(
		await fingerprints(conditions, tasks),
		saved.fingerprints,
		"Inputs changed after preflight; revalidate before measurement.",
	);
	return saved;
}

async function fingerprints(conditions, tasks) {
	const recipeFreeze = JSON.parse(await readFile(path.join(directory, "recipe-freeze.json"), "utf8"));
	for (const [relative, expected] of Object.entries(recipeFreeze.hashes)) {
		assert.equal(
			hash(await readFile(path.join(directory, relative))),
			expected,
			`Task-blind recipe freeze changed: ${relative}`,
		);
	}
	const sourceFiles = (await filesUnder(agentic)).filter((file) => file !== destination);
	sourceFiles.push(path.resolve(agentic, "../lib/report.mjs"), path.join(root, "scripts/workspaces.mjs"));
	const source = createHash("sha256");
	for (const file of sourceFiles.sort()) {
		source.update(path.relative(root, file));
		source.update(await readFile(file));
	}
	return {
		sourceHash: source.digest("hex"),
		conditionHashes: Object.fromEntries(
			Object.entries(conditions).map(([id, condition]) => [id, condition.sha256]),
		),
		taskHashes: Object.fromEntries(tasks.map((task) => [task.id, hash(JSON.stringify(task))])),
		runtimeHash: await runtimeFingerprint(root),
	};
}

async function writePreflight() {
	const audit = await readFile(path.join(directory, "AUDIT.md"), "utf8");
	assert.match(audit, /^Decision: ready\.$/m, "The independent pre-run audit must resolve material findings first.");
	const { createTransferConditions } = await import("./conditions.mjs");
	const { tasks: catalog } = await import("./tasks.mjs");
	const tasks = await Promise.all(catalog.map(freezeTask));
	const conditions = await createTransferConditions(root);
	const before = await fingerprints(conditions, tasks);
	const tests = (await filesUnder(directory)).filter((file) => file.endsWith("-tests.mjs"));
	assert.ok(tests.length >= 3, "Recipe, task, and workflow tests must all exist.");
	const checked = await runProcess(process.execPath, ["--test", ...tests], { cwd: root, timeoutMs: 120_000 });
	process.stdout.write(checked.output);
	assert.equal(checked.code, 0, "Transfer preflight tests failed.");
	assert.deepEqual(
		await fingerprints(conditions, tasks),
		before,
		"Sources changed during validation; repeat preflight.",
	);
	await writeFile(
		destination,
		JSON.stringify(
			{
				status: "ready",
				validatedAt: new Date().toISOString(),
				settings,
				fingerprints: before,
				testFiles: tests.map((file) => path.relative(root, file)),
				testOutput: checked.output,
				auditHash: hash(audit),
			},
			null,
			"\t",
		),
	);
	process.stdout.write(`Preflight ready: ${destination}\n`);
}

function hash(value) {
	return createHash("sha256").update(value).digest("hex");
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
	writePreflight().catch((error) => {
		process.stderr.write(`${error.stack}\n`);
		process.exitCode = 1;
	});
}
