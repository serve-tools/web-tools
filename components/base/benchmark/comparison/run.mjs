import { createHash } from "node:crypto";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium } from "playwright";
import { createIsolatedPage, evaluateBench, measureTimerQuantum } from "./browser-helper.mjs";
import { makeTargets } from "./src/constants.js";

const pairCount = 8;
const isolatedAggregateRepetitions = 1000;
const batch100AggregateRepetitions = 20;
const workloads = [
	{ count: 100, id: "mount-100", recorded: 40, type: "mount", warmups: 3 },
	{ count: 1000, id: "mount-1000", recorded: 40, type: "mount", warmups: 3 },
	{
		count: 1000,
		id: "update-one-1000",
		recorded: 40,
		repetitions: isolatedAggregateRepetitions,
		type: "update-series",
		warmups: 8,
	},
	{
		count: 1000,
		id: "update-100-1000",
		recorded: 40,
		repetitions: batch100AggregateRepetitions,
		size: 100,
		type: "update-batch-series",
		warmups: 8,
	},
	{ count: 1000, id: "update-1000-1000", recorded: 40, size: 1000, type: "update", warmups: 8 },
];
const conditions = ["base", "base-ui"];
const arguments_ = parseArguments(process.argv.slice(2));
const buildPath = arguments_.build;
const preflightPath = arguments_.preflight;
const outputDirectory = arguments_["output-dir"] ?? arguments_.output;
if (arguments_["confirmed-quiet-slot"] !== true || !buildPath || !preflightPath || !outputDirectory) {
	throw new Error(
		"Usage: node run.mjs --confirmed-quiet-slot --build <build-metadata.json> --preflight <preflight-result.json> --output-dir <directory>",
	);
}

const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const output = resolve(outputDirectory);
const lockPath = resolve(output, ".active.lock");
const resultPath = resolve(output, "results.json");
const progressPath = resolve(output, "progress.json");
const buildText = await readFile(resolve(buildPath), "utf8");
const build = JSON.parse(buildText);
const preflightText = await readFile(resolve(preflightPath), "utf8");
const preflight = JSON.parse(preflightText);

if (build.protocolRevision !== 3 || preflight.protocolRevision !== 3) {
	throw new Error("Formal revision 3 requires revision-3 build and preflight artifacts");
}
if (!preflight.passed) {
	throw new Error("The comparison preflight has not passed");
}
if (preflight.buildMetadataSha256 !== sha256(buildText)) {
	throw new Error("Preflight and build metadata do not match");
}

await mkdir(output, { recursive: true });
await writeFile(lockPath, `${JSON.stringify({ command: process.argv, createdAt: new Date().toISOString() })}\n`, {
	flag: "wx",
});

const result = {
	active: undefined,
	build,
	buildMetadataSha256: sha256(buildText),
	closureBefore: await verifyBuild(build),
	command: process.argv,
	createdAt: new Date().toISOString(),
	pairs: [],
	preflightSha256: sha256(preflightText),
	protocol: {
		aggregateRepetitions: {
			"update-one-1000": isolatedAggregateRepetitions,
			"update-100-1000": batch100AggregateRepetitions,
		},
		conditionOrdering: "counterbalanced independently for every workload",
		conditions,
		independentUnit: "fresh Chromium process for one condition, workload, and pair",
		pairCount,
		practicalThresholds: {
			medianNoRegressionRatio: 1 / 1.05,
			medianRegressionFraction: 0.05,
			p95NoRegressionRatio: 1 / 1.1,
			p95RegressionFraction: 0.1,
		},
		validation:
			"cheap retained-reference invariants inside each timed operation; full semantic validation once after warmups and once after recorded observations",
		workloads,
	},
	protocolRevision: 3,
	schemaVersion: 1,
	status: "running",
};

try {
	for (let pairIndex = 0; pairIndex < pairCount; ++pairIndex) {
		const pair = { pairIndex, workloads: {} };
		result.pairs.push(pair);

		for (let workloadIndex = 0; workloadIndex < workloads.length; ++workloadIndex) {
			const workload = workloads[workloadIndex];
			const order = (pairIndex + workloadIndex) % 2 === 0 ? conditions : conditions.toReversed();
			const workloadResult = { order, results: {}, workload };
			pair.workloads[workload.id] = workloadResult;

			for (const condition of order) {
				result.active = { condition, pairIndex, workload: workload.id };
				workloadResult.results[condition] = await runCondition(condition, workload, pairIndex);
				await writeProgress();
			}

			assertMatchedValidation(workload.id, workloadResult.results);
		}
	}

	result.active = undefined;
	result.closureAfter = await verifyBuild(build);
	result.finishedAt = new Date().toISOString();
	result.status = "complete";
} catch (error) {
	result.finishedAt = new Date().toISOString();
	result.status = "failed";
	result.error =
		error instanceof Error ? { message: error.message, name: error.name, stack: error.stack } : String(error);
	throw error;
} finally {
	await writeFile(resultPath, `${JSON.stringify(result, null, 2)}\n`);
	const finalText = await readFile(resultPath);
	await writeFile(`${resultPath}.sha256`, `${sha256(finalText)}  ${resultPath}\n`);
	await unlink(lockPath);
	console.log(resultPath);
}

async function runCondition(condition, workload, pairIndex) {
	await verifyBuild(build);
	const browser = await chromium.launch({ headless: true });
	try {
		const errors = [];
		const page = await createIsolatedPage(browser, build.outputs[`${condition}-benchmark`].bundle.path, errors);
		const identity = await page.evaluate(() => ({
			condition: globalThis.__checkboxBench?.condition,
			crossOriginIsolated,
			setupMs: globalThis.__checkboxBench?.setupMs,
		}));
		if (identity.condition !== condition || !identity.crossOriginIsolated) {
			throw new Error(`Condition identity or isolation failed: ${JSON.stringify(identity)}`);
		}
		const timerQuantum = await page.evaluate(measureTimerQuantum);
		if (timerQuantum.sampleCount !== 200 || !(timerQuantum.minMs > 0) || timerQuantum.minMs > 0.01) {
			throw new Error(`Timer quantum failed: ${JSON.stringify(timerQuantum)}`);
		}

		if (workload.type !== "mount") {
			await evaluateBench(page, "mount", [workload.count]);
		}

		for (let index = 0; index < workload.warmups; ++index) {
			const observation = await runOperation(page, workload, pairIndex, index);
			assertObservation(observation, workload, timerQuantum);
		}
		const afterWarmups = await evaluateBench(page, "validate");

		const observations = [];
		for (let index = 0; index < workload.recorded; ++index) {
			const operationIndex = workload.warmups + index;
			const observation = await runOperation(page, workload, pairIndex, operationIndex);
			assertObservation(observation, workload, timerQuantum);
			observations.push({
				blockDurationMs: observation.repetitions > 1 ? observation.durationMs : undefined,
				durationMs: observation.repetitions > 1 ? observation.perOperationMs : observation.durationMs,
				index,
				repetitions: observation.repetitions ?? 1,
				sink: observation.sink,
			});
		}
		const afterRecorded = await evaluateBench(page, "validate");
		await evaluateBench(page, "teardown");
		if (errors.length > 0) {
			throw new Error(`Browser errors: ${errors.join(" | ")}`);
		}
		await page.close();

		return {
			afterRecorded,
			afterWarmups,
			browserVersion: await browser.version(),
			condition,
			finishedAt: new Date().toISOString(),
			identity,
			observations,
			timerQuantum,
		};
	} finally {
		await browser.close();
	}
}

async function runOperation(page, workload, pairIndex, operationIndex) {
	if (workload.type === "mount") {
		return evaluateBench(page, "mount", [workload.count]);
	}
	if (workload.type === "update-series") {
		return evaluateBench(page, "updateSeries", [
			workload.repetitions,
			pairIndex * 1_000_000 + operationIndex * workload.repetitions,
		]);
	}
	if (workload.type === "update-batch-series") {
		return evaluateBench(page, "updateBatchSeries", [
			workload.repetitions,
			workload.size,
			pairIndex * 1000 + operationIndex * workload.repetitions,
		]);
	}
	return evaluateBench(page, "update", [
		makeTargets(workload.size, workload.count, pairIndex * 1000 + operationIndex),
	]);
}

function assertObservation(observation, workload, timerQuantum) {
	const blockDurationMs = observation.durationMs;
	if (!(blockDurationMs > 0) || blockDurationMs < 20 * timerQuantum.minMs) {
		throw new Error(`Insufficient timing precision for ${workload.id}: ${JSON.stringify(observation)}`);
	}
	if (workload.repetitions !== undefined && observation.repetitions !== workload.repetitions) {
		throw new Error(`Aggregate repetition mismatch for ${workload.id}: ${JSON.stringify(observation)}`);
	}
	if (observation.sink?.controlCount !== undefined && observation.sink.controlCount !== workload.count) {
		throw new Error(`Cheap mount invariant mismatch for ${workload.id}: ${JSON.stringify(observation.sink)}`);
	}
}

function assertMatchedValidation(workloadId, results) {
	for (const phase of ["afterWarmups", "afterRecorded"]) {
		const base = coreSink(results.base[phase]);
		const baseUI = coreSink(results["base-ui"][phase]);
		if (JSON.stringify(base) !== JSON.stringify(baseUI)) {
			throw new Error(`Semantic sink mismatch for ${workloadId}/${phase}: ${JSON.stringify({ base, baseUI })}`);
		}
	}
}

function coreSink({ checkedCount, controlCount, formValues, labelCount }) {
	return { checkedCount, controlCount, formValues, labelCount };
}

async function writeProgress() {
	await writeFile(progressPath, `${JSON.stringify(result, null, 2)}\n`);
}

async function verifyBuild(metadata) {
	const failures = [];
	const entries = new Map();
	for (const outputMetadata of Object.values(metadata.outputs)) {
		entries.set(outputMetadata.bundle.path, outputMetadata.bundle.sha256);
		for (const source of outputMetadata.inputClosure) {
			entries.set(source.path, source.sha256);
		}
	}
	entries.set(resolve(metadata.closure.path, "package-lock.json"), metadata.closure.packageLockSha256);
	entries.set(resolve(metadata.closure.path, "package.json"), metadata.closure.packageJSONSha256);
	for (const [path, expected] of entries) {
		const actual = sha256(await readFile(path));
		if (actual !== expected) {
			failures.push({ actual, expected, path });
		}
	}
	if (failures.length > 0) {
		throw new Error(`Build closure changed: ${JSON.stringify(failures.slice(0, 5))}`);
	}
	const productionClosureSha256 = sha256(JSON.stringify(metadata.productionClosure.entries));
	if (productionClosureSha256 !== metadata.productionClosure.sha256) {
		throw new Error("Production closure identity is invalid");
	}
	return { fileCount: entries.size, productionClosureSha256 };
}

function parseArguments(values) {
	const parsed = {};
	for (let index = 0; index < values.length; ++index) {
		const argument = values[index];
		if (!argument.startsWith("--")) {
			throw new Error(`Unexpected argument ${argument}`);
		}
		const name = argument.slice(2);
		if (name === "confirmed-quiet-slot") {
			parsed[name] = true;
			continue;
		}
		if (!values[index + 1] || values[index + 1].startsWith("--")) {
			throw new Error(`Expected a value after ${argument}`);
		}
		parsed[name] = values[++index];
	}
	return parsed;
}
