import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { lstat, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { gradeArtifact, runProcess } from "./grading.mjs";
import { renderReport, summarize } from "./report.mjs";

const sourceDirectory = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(sourceDirectory, "../../..");
const correctionNames = [
	"opaque-cursor-permits-extra-encode-input-keys",
	"inventory-allow-header-compares-method-set",
	"inventory-http-contract-server-import-evidence",
];

/** Apply the audit's three explicitly bounded corrections to a frozen task. */
export function correctedTask(task) {
	const corrected = structuredClone(task);
	const applied = [];

	if (corrected.id === "opaque-cursor") {
		const rejectedExtraInput = '\n\t{ offset: 1, label: "x", extra: true },';

		assert.equal(
			count(corrected.programs.hidden, rejectedExtraInput),
			1,
			"Expected the frozen opaque-cursor hidden program to reject an undisclosed input key.",
		);
		corrected.programs.hidden = corrected.programs.hidden.replace(rejectedExtraInput, "");
		applied.push(correctionNames[0]);
	}

	if (corrected.id === "inventory-http-handler") {
		const orderedAllow = 'assert.equal(response.headers.get("allow"), "GET, PUT");';
		const unorderedAllow =
			'assert.deepEqual(response.headers.get("allow")?.split(/\\s*,\\s*/).sort(), ["GET", "PUT"]);';

		assert.equal(
			count(corrected.programs.hidden, orderedAllow),
			1,
			"Expected the frozen inventory hidden program to compare Allow header order.",
		);
		corrected.programs.hidden = corrected.programs.hidden.replace(orderedAllow, unorderedAllow);
		assert.deepEqual(
			corrected.requiredRuntimeImports,
			[["@serve-tools/http-contract"], ["@serve-tools/router"]],
			"Expected the frozen inventory task to require only the HTTP contract root import.",
		);
		corrected.requiredRuntimeImports = [
			["@serve-tools/http-contract", "@serve-tools/http-contract/server"],
			["@serve-tools/router"],
		];
		applied.push(correctionNames[1], correctionNames[2]);
	}

	return { applied, task: corrected };
}

/** Regrade a complete saved run against its archived runtime and frozen task checks. */
export async function rescore(input) {
	const started = performance.now();
	const directory = path.resolve(input);
	const correctedDirectory = path.join(directory, "corrected");
	const [planSource, recordsSource, archive] = await Promise.all([
		readFile(path.join(directory, "plan.json"), "utf8"),
		readFile(path.join(directory, "records.jsonl"), "utf8"),
		readFile(path.join(directory, "runtime.tar.gz")),
	]);
	const plan = JSON.parse(planSource);
	const records =
		recordsSource.trim() === ""
			? []
			: recordsSource
					.trim()
					.split("\n")
					.map((line) => JSON.parse(line));
	const archiveHash = hash(archive);
	const gradingHash = hash(await readFile(path.join(sourceDirectory, "grading.mjs")));

	assert.equal(
		archiveHash,
		plan.metadata?.runtimeArchiveHash,
		"Saved runtime archive hash does not match plan metadata.",
	);
	assert.equal(
		await exists(correctedDirectory),
		false,
		"Refusing to replace an existing corrected evidence directory.",
	);
	assert.equal(Array.isArray(plan.tasks), true, "Saved plan has no frozen tasks.");
	assert.equal(Array.isArray(plan.jobs), true, "Saved plan has no jobs.");
	const plannedAttempts = new Set(plan.jobs.map(attemptID));
	const recordedAttempts = new Set(records.map(attemptID));
	assert.equal(recordedAttempts.size, records.length, "Saved records have duplicate attempt identities.");
	assert.equal(
		[...recordedAttempts].every((attempt) => plannedAttempts.has(attempt)),
		true,
		"Saved records include attempts outside the frozen plan.",
	);

	const taskByID = new Map(plan.tasks.map((task) => [task.id, task]));
	assert.equal(taskByID.size, plan.tasks.length, "Frozen plan has duplicate task ids.");
	const correctedTasks = new Map();
	const appliedCorrections = new Set();

	for (const task of plan.tasks) {
		assert.equal(typeof task.programs?.smoke, "string", `${task.id}: frozen smoke program is required.`);
		assert.equal(typeof task.programs?.hidden, "string", `${task.id}: frozen hidden program is required.`);
		const correction = correctedTask(task);

		correctedTasks.set(task.id, correction);
		for (const name of correction.applied) {
			appliedCorrections.add(name);
		}
	}
	assert.deepEqual(
		[...appliedCorrections].sort(),
		[...correctionNames].sort(),
		"Frozen plan does not match the audited tasks.",
	);

	const temporary = await mkdtemp(path.join(temporaryRoot(), "serve-tools-agentic-rescore-"));
	try {
		const runtime = await extractRuntime(directory, temporary);
		const correctedRecords = [];

		for (const [index, record] of records.entries()) {
			const task = taskByID.get(record.taskId);
			assert.notEqual(task, undefined, `Record references unknown frozen task ${record.taskId}.`);
			const artifact = await readFile(path.join(directory, "attempts", attemptID(record), "solution.ts"), "utf8");
			const originalReplay = await grade(task, artifact, runtime);
			const correction = correctedTasks.get(record.taskId);
			const correctedGrade = await grade(correction.task, artifact, runtime);
			const originalParity = parity(record.grade, originalReplay);
			const correctedArtifactPass = artifactPass(correctedGrade);
			const correctedPass = record.status === "completed" && correctedArtifactPass;

			correctedRecords.push({
				...record,
				attemptId: attemptID(record),
				artifactPass: correctedArtifactPass,
				corrections: correction.applied,
				grade: correctedGrade,
				original: {
					artifactPass: record.artifactPass,
					cost: {
						agentElapsedMs: record.agentElapsedMs,
						discoveryToFirstWriteMs: record.discoveryToFirstWriteMs,
						elapsedMs: record.elapsedMs,
						repairAfterFirstFailureMs: record.repairAfterFirstFailureMs,
						usage: record.usage,
						usageComplete: record.usageComplete,
					},
					grade: record.grade,
					pass: record.pass,
					status: record.status,
				},
				originalGradeReplay: originalParity,
				originalRecord: record,
				pass: correctedPass,
			});
			if ((index + 1) % 20 === 0 || index + 1 === records.length) {
				process.stdout.write(`Rescored ${index + 1}/${records.length} artifacts.\n`);
			}
		}

		const report = createCorrectedReport(correctedRecords, plan, archiveHash, correctedTasks);
		const provenance = {
			archiveHash,
			gradingHash,
			input: directory,
			planHash: hash(planSource),
			recordsHash: hash(recordsSource),
			replayElapsedMs: performance.now() - started,
			sourceHash: hash(await readFile(fileURLToPath(import.meta.url))),
		};
		await writeCorrectedEvidence(correctedDirectory, correctedRecords, report, {
			correctedTasks,
			plan,
			provenance,
		});

		return report;
	} finally {
		await rm(temporary, { force: true, recursive: true });
	}
}

async function extractRuntime(input, temporary) {
	const directory = path.join(temporary, "runtime");

	await mkdir(directory);
	const extracted = await runProcess("tar", ["-xzf", path.join(input, "runtime.tar.gz"), "-C", directory], {
		timeoutMs: 60_000,
	});
	if (extracted.code !== 0) {
		throw new Error(`Cannot extract saved runtime: ${extracted.output}`);
	}
	const nodeModules = path.join(directory, "node_modules");
	const tsc = path.join(nodeModules, "typescript", "bin", "tsc");

	assert.equal((await lstat(nodeModules)).isDirectory(), true, "Saved runtime has no node_modules directory.");
	assert.equal((await lstat(tsc)).isFile(), true, "Saved runtime has no TypeScript compiler.");

	return { directory, nodeModules, tsc };
}

async function grade(task, source, runtime) {
	try {
		return await gradeArtifact({ root, runtime, task, source, hidden: true });
	} catch (error) {
		return {
			compile: false,
			contracts: false,
			hidden: false,
			infrastructureError: true,
			feedback: error.message,
			smoke: false,
		};
	}
}

function createCorrectedReport(records, plan, archiveHash, correctedTasks) {
	const taskHashes = correctedTaskHashes(plan, correctedTasks);
	const metadata = {
		...plan.metadata,
		completedPlan: records.length === plan.jobs.length,
		taskHashes,
		rescore: {
			archiveHash,
			corrections: correctionNames,
			frozenInputsOnly: true,
			originalTaskHashes: plan.metadata.taskHashes,
			originalGradesReplayed: true,
		},
	};
	const report = summarize(records, metadata);
	const parity = records.map((record) => record.originalGradeReplay);

	return {
		...report,
		rescore: {
			attempts: records.length,
			changedPasses: records.filter((record) => record.original.pass !== record.pass).length,
			corrections: correctionNames,
			missingPlannedAttempts: plan.jobs.length - records.length,
			originalReplayDiscrepancies: parity.filter((result) => !result.matches).length,
			originalReplayParity: parity,
		},
	};
}

async function writeCorrectedEvidence(directory, records, report, { correctedTasks, plan, provenance }) {
	await mkdir(directory, { recursive: true });
	const correctedPlan = {
		...plan,
		metadata: {
			...plan.metadata,
			completedPlan: records.length === plan.jobs.length,
			taskHashes: correctedTaskHashes(plan, correctedTasks),
			rescore: { ...provenance, originalTaskHashes: plan.metadata.taskHashes },
		},
		tasks: plan.tasks.map((task) => correctedTasks.get(task.id).task),
	};
	await writeFile(
		path.join(directory, "records.jsonl"),
		`${records.map((record) => JSON.stringify(record)).join("\n")}\n`,
	);
	await writeFile(path.join(directory, "plan.json"), `${JSON.stringify(correctedPlan, null, 2)}\n`);
	await writeFile(path.join(directory, "report.json"), `${JSON.stringify(report, null, 2)}\n`);
	await writeFile(path.join(directory, "provenance.json"), `${JSON.stringify(provenance, null, 2)}\n`);
	await writeFile(
		path.join(directory, "report.md"),
		`${renderReport(report)}\n\n## Corrected grading\n\nChanged success outcomes: ${report.rescore.changedPasses}. Original grader replay discrepancies: ${report.rescore.originalReplayDiscrepancies}.\n\nThe corrected records preserve original grades, costs, and elapsed fields. Original grader replay discrepancies are recorded explicitly in corrected/records.jsonl and report.json.\n`,
	);
}

function correctedTaskHashes(plan, correctedTasks) {
	return Object.fromEntries(
		plan.tasks.map((task) => [task.id, hash(JSON.stringify(correctedTasks.get(task.id).task))]),
	);
}

function parity(expected, actual) {
	const fields = ["compile", "contracts", "smoke", "hidden"];
	const differences = Object.fromEntries(
		fields
			.filter((field) => expected?.[field] !== actual?.[field])
			.map((field) => [field, { replay: actual?.[field] ?? null, saved: expected?.[field] ?? null }]),
	);

	return { differences, matches: Object.keys(differences).length === 0, replay: actual, saved: expected ?? null };
}

function artifactPass(grade) {
	return grade.compile && grade.contracts !== false && grade.smoke && grade.hidden;
}

function attemptID(record) {
	return `${record.seed}-${record.run}-${record.taskId}-${record.variant}`;
}

function count(source, value) {
	return source.split(value).length - 1;
}

function hash(value) {
	return createHash("sha256").update(value).digest("hex");
}

async function exists(target) {
	try {
		await lstat(target);

		return true;
	} catch (error) {
		if (error?.code === "ENOENT") {
			return false;
		}

		throw error;
	}
}

function temporaryRoot() {
	return process.platform === "darwin" ? "/private/tmp" : os.tmpdir();
}

function parseInput(args) {
	if (args.length !== 2 || args[0] !== "--input" || !args[1]) {
		throw new Error("Usage: node benchmark/skills/agentic/rescore.mjs --input DIR");
	}

	return args[1];
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
	rescore(parseInput(process.argv.slice(2)))
		.then((report) => process.stdout.write(`${renderReport(report)}\n`))
		.catch((error) => {
			process.stderr.write(`${error.stack}\n`);
			process.exitCode = 1;
		});
}
