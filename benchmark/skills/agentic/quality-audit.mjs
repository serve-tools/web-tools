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
const probePrograms = {
	"batch-operation": `

let invalidHighWaterMark;
try {
	invalidHighWaterMark = createBatchOperation([], () => 0, { highWaterMark: null });
} catch {
	invalidHighWaterMark = null;
}
if (invalidHighWaterMark !== null) {
	try {
		await assert.rejects(invalidHighWaterMark.result);
	} finally {
		try {
			await invalidHighWaterMark[Symbol.asyncDispose]();
		} catch {}
	}
}
`,
	"deferred-projection": `

const sparseItems = Array(1);
assert.throws(
	() => createDeferredProjection({ items: sparseItems, limit: 1, enabled: true }, () => {}),
	TypeError,
);
const validProjection = createDeferredProjection({ items: [2], limit: 1, enabled: true }, () => {});
assert.throws(() => validProjection.setItems(sparseItems), TypeError);
assert.deepEqual(validProjection.snapshot(), [4]);
validProjection.dispose();
`,
};

/** Append disclosed-requirement probes to the two affected frozen hidden programs. */
export function qualityTask(task) {
	const probe = probePrograms[task.id];

	if (probe === undefined) {
		return { applied: false, task };
	}

	assert.equal(typeof task.programs?.hidden, "string", `${task.id}: frozen hidden program is required.`);
	assert.equal(task.programs.hidden.includes(probe), false, `${task.id}: quality probe is already present.`);

	return {
		applied: true,
		task: {
			...structuredClone(task),
			programs: {
				...task.programs,
				hidden: `${task.programs.hidden}${probe}`,
			},
		},
	};
}

/** Verify disclosed contract details against every saved artifact without model calls. */
export async function auditQuality(input) {
	const started = performance.now();
	const directory = path.resolve(input);
	const correctedDirectory = path.join(directory, "corrected");
	const qualityDirectory = path.join(directory, "quality");
	const [planSource, recordsSource, archive] = await Promise.all([
		readFile(path.join(correctedDirectory, "plan.json"), "utf8"),
		readFile(path.join(correctedDirectory, "records.jsonl"), "utf8"),
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

	assert.equal(
		archiveHash,
		plan.metadata.runtimeArchiveHash,
		"Runtime archive hash does not match the corrected frozen plan.",
	);
	assert.equal(archiveHash, plan.metadata.rescore?.archiveHash, "Corrected-plan archive provenance does not match.");
	assert.equal(await exists(qualityDirectory), false, "Refusing to replace an existing quality evidence directory.");
	assert.equal(Array.isArray(plan.tasks), true, "Corrected plan has no frozen tasks.");
	assert.equal(Array.isArray(plan.jobs), true, "Corrected plan has no jobs.");

	const tasks = new Map();
	for (const task of plan.tasks) {
		const quality = qualityTask(task);
		tasks.set(task.id, quality);
	}
	assert.deepEqual(
		[...tasks.values()]
			.filter((quality) => quality.applied)
			.map((quality) => quality.task.id)
			.sort(),
		Object.keys(probePrograms).sort(),
		"Corrected plan does not include exactly the two audited tasks.",
	);

	const temporary = await mkdtemp(path.join(temporaryRoot(), "serve-tools-agentic-quality-"));
	try {
		const runtime = await extractRuntime(directory, temporary);
		const qualityRecords = [];
		let audited = 0;

		for (const record of records) {
			const quality = tasks.get(record.taskId);
			assert.notEqual(quality, undefined, `Record references unknown task ${record.taskId}.`);
			let grade = record.grade;

			if (quality.applied) {
				const source = await readFile(
					path.join(directory, "attempts", attemptID(record), "solution.ts"),
					"utf8",
				);
				grade = await gradeArtifact({ root, runtime, task: quality.task, source, hidden: true });
				++audited;
				if (audited % 20 === 0) {
					process.stdout.write(`Quality-checked ${audited} affected artifacts.\n`);
				}
			}

			const artifactPass = quality.applied ? passes(grade) : record.artifactPass;
			const pass = quality.applied ? record.status === "completed" && artifactPass : record.pass;
			qualityRecords.push({
				...record,
				artifactPass,
				grade,
				originalCorrectedGrade: record.grade,
				originalCorrectedPass: record.pass,
				pass,
				quality: {
					applied: quality.applied,
					changedArtifactPass: record.artifactPass !== artifactPass,
					changedPass: record.pass !== pass,
					probeHash: quality.applied ? hash(probePrograms[record.taskId]) : null,
				},
			});
		}
		assert.equal(audited, 60, "Expected exactly 60 batch/deferred artifacts in the frozen corrected records.");

		const report = createReport(qualityRecords, plan, tasks, started);
		await writeEvidence(qualityDirectory, qualityRecords, report, plan, tasks, archiveHash, started);

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

function createReport(records, plan, tasks, started) {
	const qualityTasks = new Map([...tasks].map(([id, quality]) => [id, quality.task]));
	const taskHashes = Object.fromEntries(
		plan.tasks.map((task) => [task.id, hash(JSON.stringify(qualityTasks.get(task.id)))]),
	);
	const metadata = {
		...plan.metadata,
		completedPlan: records.length === plan.jobs.length,
		taskHashes,
		qualityAudit: {
			probeHashes: Object.fromEntries(Object.entries(probePrograms).map(([id, source]) => [id, hash(source)])),
			probesAppendedToExistingHiddenPrograms: true,
		},
	};
	const report = summarize(records, metadata);

	return {
		...report,
		qualityAudit: {
			affectedArtifacts: records.filter((record) => record.quality.applied).length,
			changedArtifactPasses: records.filter((record) => record.quality.changedArtifactPass).length,
			changedPasses: records.filter((record) => record.quality.changedPass).length,
			probePrograms,
			wallElapsedMs: performance.now() - started,
		},
	};
}

async function writeEvidence(directory, records, report, plan, tasks, archiveHash, started) {
	await mkdir(directory, { recursive: true });
	const qualityTasks = new Map([...tasks].map(([id, quality]) => [id, quality.task]));
	const provenance = {
		archiveHash,
		correctedPlanHash: hash(JSON.stringify(plan)),
		correctedRecordsHash: hash(records.map((record) => JSON.stringify(record.originalCorrectedGrade)).join("\n")),
		gradingHash: hash(await readFile(path.join(sourceDirectory, "grading.mjs"))),
		probeHashes: Object.fromEntries(Object.entries(probePrograms).map(([id, source]) => [id, hash(source)])),
		probePrograms,
		sourceHash: hash(await readFile(fileURLToPath(import.meta.url))),
		wallElapsedMs: performance.now() - started,
	};
	const qualityPlan = {
		...plan,
		metadata: {
			...plan.metadata,
			completedPlan: records.length === plan.jobs.length,
			taskHashes: Object.fromEntries(
				plan.tasks.map((task) => [task.id, hash(JSON.stringify(qualityTasks.get(task.id)))]),
			),
			qualityAudit: provenance,
		},
		tasks: plan.tasks.map((task) => qualityTasks.get(task.id)),
	};

	await writeFile(
		path.join(directory, "records.jsonl"),
		`${records.map((record) => JSON.stringify(record)).join("\n")}\n`,
	);
	await writeFile(path.join(directory, "plan.json"), `${JSON.stringify(qualityPlan, null, 2)}\n`);
	await writeFile(path.join(directory, "report.json"), `${JSON.stringify(report, null, 2)}\n`);
	await writeFile(path.join(directory, "provenance.json"), `${JSON.stringify(provenance, null, 2)}\n`);
	await writeFile(
		path.join(directory, "report.md"),
		`${renderReport(report)}\n\n## Disclosed-requirement quality audit\n\nTwo probes were appended to the existing frozen hidden programs, so an existing failure remains a failure. The probes check explicit highWaterMark and finite-items requirements without changing original costs or elapsed measurements.\n\nAffected artifacts: ${report.qualityAudit.affectedArtifacts}. Changed terminal artifact grades: ${report.qualityAudit.changedArtifactPasses}. Changed completed-attempt passes: ${report.qualityAudit.changedPasses}.\n`,
	);
}

function passes(grade) {
	return grade.compile && grade.contracts !== false && grade.smoke && grade.hidden;
}

function attemptID(record) {
	return `${record.seed}-${record.run}-${record.taskId}-${record.variant}`;
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
		throw new Error("Usage: node benchmark/skills/agentic/quality-audit.mjs --input DIR");
	}

	return args[1];
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
	auditQuality(parseInput(process.argv.slice(2)))
		.then((report) => process.stdout.write(`${renderReport(report)}\n`))
		.catch((error) => {
			process.stderr.write(`${error.stack}\n`);
			process.exitCode = 1;
		});
}
