import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { freezeTask, runProcess } from "../grading.mjs";
import { filesUnder, runtimeFingerprint } from "../snapshot.mjs";
import { settings } from "./settings.mjs";

const directory = path.dirname(fileURLToPath(import.meta.url));
const agentic = path.dirname(directory);
const root = path.resolve(directory, "../../../..");
const destination = path.join(directory, "preflight.json");

export async function verifyPreflight({ conditions, tasks, options }) {
	const saved = JSON.parse(await readFile(destination, "utf8"));
	assert.equal(saved.status, "ready");
	for (const [key, value] of Object.entries(settings)) {
		assert.deepEqual(options[key], value, `Protocol setting: ${key}`);
	}
	assert.deepEqual(
		await fingerprints(conditions, tasks),
		saved.fingerprints,
		"Inputs changed after validation; repeat preflight.",
	);
	return saved;
}

async function fingerprints(conditions, tasks) {
	const helperFreeze = JSON.parse(await readFile(path.join(directory, "helper-freeze.json"), "utf8"));
	for (const [relative, expected] of Object.entries(helperFreeze.hashes)) {
		assert.equal(
			hash(await readFile(path.join(directory, relative))),
			expected,
			`Helper freeze changed: ${relative}`,
		);
	}
	const files = (await filesUnder(agentic)).filter((file) => file !== destination);
	files.push(
		path.join(root, "package.json"),
		path.join(root, "scripts/workspaces.mjs"),
		path.join(root, "benchmark/skills/lib/report.mjs"),
	);
	const source = createHash("sha256");
	for (const file of files.sort()) {
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

async function main() {
	const audit = await readFile(path.join(directory, "GRADER-AUDIT.md"), "utf8");
	assert.match(audit, /^Decision: ready\.$/m, "Independent grader review must resolve all material findings.");
	const smoke = JSON.parse(await readFile(path.join(directory, "accounting-receipt.json"), "utf8"));
	assert.equal(smoke.pass, true, "Record passing live accounting stress evidence first.");
	assert.equal(
		hash(await readFile(path.join(agentic, "provider.mjs"))),
		smoke.providerHash,
		"Provider changed after accounting smoke.",
	);
	const alternates = JSON.parse(await readFile(path.join(directory, "alternate-freeze.json"), "utf8"));
	assert.equal(
		Object.keys(alternates.initialHashes).length,
		24,
		"Both independent cohorts need initial source hashes.",
	);
	const { tasks: catalog } = await import("./tasks.mjs");
	assert.deepEqual(Object.keys(alternates.initialHashes).sort(), catalog.map((task) => task.id).sort());
	for (const task of catalog) {
		const initialPrompt = JSON.parse(
			await readFile(
				alternates.promptRevisions?.[task.id]?.packet ??
					path.join(alternates.initialArchiveDirectory, task.id, "prompt.json"),
				"utf8",
			),
		);
		assert.equal(initialPrompt.prompt, task.prompt, `Independent author received a different prompt: ${task.id}`);
		if (alternates.promptRevisions?.[task.id]) {
			const revision = alternates.promptRevisions[task.id];
			assert.equal(hash(await readFile(revision.packet)), revision.packetHash);
			assert.equal(hash(await readFile(revision.authorRecord)), revision.authorRecordHash);
		}
		assert.equal(
			hash(await readFile(path.join(alternates.initialArchiveDirectory, task.id, "solution.alternate.ts"))),
			alternates.initialHashes[task.id],
			`Independent initial source archive: ${task.id}`,
		);
		assert.equal(
			hash(await readFile(path.join(directory, "tasks", task.id, "solution.alternate.ts"))),
			alternates.finalHashes[task.id],
			`Final positive source changed: ${task.id}`,
		);
		assert.equal(hash(task.prompt), alternates.finalPromptHashes[task.id], `Final prompt changed: ${task.id}`);
	}
	const tasks = await Promise.all(catalog.map(freezeTask));
	const { createAblationConditions } = await import("./conditions.mjs");
	const conditions = await createAblationConditions(root);
	const before = await fingerprints(conditions, tasks);
	const tests = (await filesUnder(directory)).filter((file) => file.endsWith("-tests.mjs"));
	const checked = await runProcess(process.execPath, ["--test", ...tests], { cwd: root, timeoutMs: 180_000 });
	process.stdout.write(checked.output);
	assert.equal(checked.code, 0, "Ablation tests failed.");
	assert.deepEqual(await fingerprints(conditions, tasks), before, "Sources changed during preflight.");
	await writeFile(
		destination,
		JSON.stringify(
			{
				status: "ready",
				validatedAt: new Date().toISOString(),
				settings,
				fingerprints: before,
				accountingReceipt: smoke,
				tests: tests.map((file) => path.relative(root, file)),
				testOutput: checked.output,
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
	main().catch((error) => {
		process.stderr.write(`${error.stack}\n`);
		process.exitCode = 1;
	});
}
