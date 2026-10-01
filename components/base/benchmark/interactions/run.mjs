import { mkdir, readFile, unlink } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium } from "playwright";
import { createIsolatedPage, evaluateBench, measureTimerQuantum } from "./browser-helper.mjs";
import { sha256, verifyBuild, writeHashedJSON } from "./integrity.mjs";
import { conditions, metrics, pairCount, practicalThresholds, protocolRevision, workloads } from "./protocol.mjs";

const arguments_ = parseArguments(process.argv.slice(2));
const outputDirectory = arguments_["output-dir"] ?? arguments_.output;
if (arguments_["confirmed-quiet-slot"] !== true || !arguments_.build || !arguments_.preflight || !outputDirectory) {
	throw new Error(
		"Usage: node run.mjs --confirmed-quiet-slot --build <build-metadata.json> --preflight <preflight-result.json> --output-dir <directory>",
	);
}

const output = resolve(outputDirectory);
const rawDirectory = resolve(output, "raw");
const lockPath = resolve(output, ".active.lock");
const progressPath = resolve(output, "progress.json");
const resultPath = resolve(output, "results.json");
const buildText = await readFile(resolve(arguments_.build), "utf8");
const build = JSON.parse(buildText);
const preflightText = await readFile(resolve(arguments_.preflight), "utf8");
const preflight = JSON.parse(preflightText);
if (build.protocolRevision !== protocolRevision || preflight.protocolRevision !== protocolRevision) {
	throw new Error(`Formal timing requires protocol revision ${protocolRevision} artifacts`);
}
if (!preflight.passed || preflight.buildMetadataSha256 !== sha256(buildText)) {
	throw new Error("The interaction preflight is missing, failed, or belongs to another build");
}

await mkdir(rawDirectory, { recursive: true });
await writeHashedJSON(lockPath, { command: process.argv, createdAt: new Date().toISOString() });
const result = {
	active: undefined,
	artifacts: [],
	buildMetadataSha256: sha256(buildText),
	closureBefore: await verifyBuild(build),
	command: process.argv,
	createdAt: new Date().toISOString(),
	pairs: [],
	preflightSha256: sha256(preflightText),
	protocol: {
		conditionOrdering: "counterbalanced independently for every workload",
		conditions,
		independentUnit: "fresh Chromium process for one condition, workload, and pair",
		metrics,
		pairCount,
		practicalThresholds,
		validation:
			"final public DOM attributes awaited inside each clock; constant-size retained-reference checks inside each clock; full semantic and accessibility-related DOM validation after warmup and recorded blocks",
		workloads,
	},
	protocolRevision,
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
				const raw = await runCondition(condition, workload);
				const rawPath = resolve(rawDirectory, `pair-${pairIndex + 1}-${workload.id}-${condition}.json`);
				const artifact = await writeHashedJSON(rawPath, raw);
				result.artifacts.push(artifact);
				workloadResult.results[condition] = { ...raw, artifact };
				await writeHashedJSON(progressPath, result);
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
	const artifact = await writeHashedJSON(resultPath, result);
	await Promise.all([unlink(lockPath), unlink(`${lockPath}.sha256`)]);
	console.log(JSON.stringify({ artifact, status: result.status }, null, 2));
}

async function runCondition(condition, workload) {
	await verifyBuild(build);
	const browser = await chromium.launch({ headless: true });
	try {
		const errors = [];
		const page = await createIsolatedPage(
			browser,
			build.outputs[`${condition}-${workload.component}-benchmark`].bundle.path,
			errors,
		);
		const identity = await page.evaluate(() => ({
			component: globalThis.__interactionBench?.component,
			condition: globalThis.__interactionBench?.condition,
			crossOriginIsolated,
		}));
		if (
			identity.condition !== condition ||
			identity.component !== workload.component ||
			!identity.crossOriginIsolated
		) {
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
			assertObservation(await runOperation(page, workload), workload, timerQuantum);
		}
		const afterWarmups = await evaluateBench(page, workload.type === "teardown" ? "validateEmpty" : "validate");
		const observations = [];
		for (let index = 0; index < workload.recorded; ++index) {
			const observation = await runOperation(page, workload);
			assertObservation(observation, workload, timerQuantum);
			observations.push({
				durationMs: observation.durationMs,
				index,
				renderOpportunityDurationMs: observation.renderOpportunityDurationMs,
				repetitions: observation.repetitions,
				sink: observation.sink,
			});
		}
		const afterRecorded = await evaluateBench(page, workload.type === "teardown" ? "validateEmpty" : "validate");
		if (workload.type !== "teardown") {
			await evaluateBench(page, "teardown");
		}
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

async function runOperation(page, workload) {
	if (workload.type === "mount") {
		return evaluateBench(page, "mount", [workload.count]);
	}
	if (workload.type === "update") {
		return evaluateBench(page, "update", [workload.repetitions]);
	}
	await evaluateBench(page, "mount", [workload.count]);
	return evaluateBench(page, "teardown");
}

function assertObservation(observation, workload, timerQuantum) {
	if (!(observation.durationMs > 0) || observation.durationMs < 20 * timerQuantum.minMs) {
		throw new Error(`Insufficient semantic timing precision for ${workload.id}: ${JSON.stringify(observation)}`);
	}
	if (
		!(observation.renderOpportunityDurationMs >= observation.durationMs) ||
		observation.renderOpportunityDurationMs < 20 * timerQuantum.minMs
	) {
		throw new Error(`Invalid render-opportunity timing for ${workload.id}: ${JSON.stringify(observation)}`);
	}
	if ((workload.repetitions ?? 1) !== observation.repetitions) {
		throw new Error(`Repetition mismatch for ${workload.id}: ${JSON.stringify(observation)}`);
	}
	if (observation.sink.itemCount !== (workload.type === "teardown" ? 0 : workload.count)) {
		throw new Error(`Item-count invariant failed for ${workload.id}: ${JSON.stringify(observation.sink)}`);
	}
}

function assertMatchedValidation(workloadId, results) {
	for (const phase of ["afterWarmups", "afterRecorded"]) {
		if (JSON.stringify(results.base[phase]) !== JSON.stringify(results["base-ui"][phase])) {
			throw new Error(`Semantic sink mismatch for ${workloadId}/${phase}`);
		}
	}
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
