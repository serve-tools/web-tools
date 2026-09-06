import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { arch, cpus, platform, release, totalmem } from "node:os";
import { resolve } from "node:path";
import { promisify } from "node:util";
import { chromium } from "playwright";

const runProcess = promisify(execFile);
const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const protocolRevision = 4;
const conditions = ["baseline", "candidate"];
const pairCount = 8;
const workloads = [
	{ acceptanceEligible: false, iterations: 1, name: "first-mount", operations: 1, recorded: 40, warmups: 0 },
	{ acceptanceEligible: true, iterations: 1, name: "mount-1000", operations: 1_000, recorded: 40, warmups: 3 },
	{ acceptanceEligible: true, iterations: 10_000, name: "update", operations: 10_000, recorded: 40, warmups: 3 },
	{ acceptanceEligible: true, iterations: 10_000, name: "reconnect", operations: 10_000, recorded: 40, warmups: 3 },
	{ acceptanceEligible: true, iterations: 10_000, name: "move", operations: 10_000, recorded: 40, warmups: 3 },
];
const origin = "https://base-template-benchmark.invalid/";
const arguments_ = parseArguments(process.argv.slice(2));
const smoke = arguments_.smoke === true;
const precision = arguments_.precision === true;
const buildPath = arguments_.build;
const outputDirectory = arguments_["output-dir"] ?? arguments_.output;

if (
	Number(smoke) + Number(precision) + Number(arguments_["confirmed-quiet-slot"] === true) !== 1 ||
	!buildPath ||
	!outputDirectory
) {
	throw new Error(
		"Usage: node run.mjs (--smoke | --precision | --confirmed-quiet-slot) --build <manifest.json> --output-dir <directory>",
	);
}

const output = resolve(outputDirectory);
const progressPath = resolve(output, "progress.json");
const buildText = await readFile(resolve(buildPath), "utf8");
const build = JSON.parse(buildText);

assertBuildManifest(build);
await mkdir(output, { recursive: true });

const expectedSinks = new Map();
const progress = { active: undefined, pairs: [], precisionConditions: {}, smokeConditions: {} };
let browserVersion;

try {
	if (smoke) {
		for (const condition of conditions) {
			progress.active = { condition, mode: "smoke" };
			progress.smokeConditions[condition] = await runSmokeCondition(condition, build.builds[condition]);
		}
	} else if (precision) {
		for (const condition of conditions) {
			const conditionResult = { condition, workloads: {} };

			progress.precisionConditions[condition] = conditionResult;

			for (const workload of workloads.filter(({ acceptanceEligible }) => acceptanceEligible)) {
				progress.active = { condition, mode: "precision", workload: workload.name };
				conditionResult.workloads[workload.name] = await runMeasuredCondition(
					condition,
					build.builds[condition],
					{ ...workload, recorded: 5, warmups: 1 },
				);
			}
		}
	} else {
		for (let pairIndex = 0; pairIndex < pairCount; ++pairIndex) {
			const pair = { pairIndex, workloads: {} };

			progress.pairs.push(pair);

			for (let workloadIndex = 0; workloadIndex < workloads.length; ++workloadIndex) {
				const workload = workloads[workloadIndex];
				const order = (pairIndex + workloadIndex) % 2 === 0 ? conditions : conditions.toReversed();
				const workloadResult = { order, results: {}, workload };

				pair.workloads[workload.name] = workloadResult;

				for (const condition of order) {
					progress.active = { condition, mode: "measurement", pairIndex, workload: workload.name };
					workloadResult.results[condition] = await runMeasuredCondition(
						condition,
						build.builds[condition],
						workload,
					);
					await writeProgress();
				}
			}
		}
	}

	progress.active = undefined;
} catch (error) {
	const failurePath = resolve(output, "failure.json");

	await writeFile(
		failurePath,
		`${JSON.stringify(
			{
				build,
				buildManifestSha256: sha256(buildText),
				createdAt: new Date().toISOString(),
				error:
					error instanceof Error
						? { message: error.message, name: error.name, stack: error.stack }
						: String(error),
				mode: smoke ? "smoke" : precision ? "precision" : "measurement",
				partial: progress,
				protocolRevision,
				schemaVersion: 2,
			},
			null,
			2,
		)}\n`,
	);

	throw new Error(`Template benchmark failed; partial results were preserved at ${failurePath}`, { cause: error });
}

const repository = resolve(new URL("../../../..", import.meta.url).pathname);
const [{ stdout: revision }, { stdout: status }] = await Promise.all([
	runProcess("git", ["rev-parse", "HEAD"], { cwd: repository, encoding: "utf8" }),
	runProcess("git", ["status", "--short"], { cwd: repository, encoding: "utf8" }),
]);
const result = {
	build,
	buildManifestSha256: sha256(buildText),
	command: process.argv,
	createdAt: new Date().toISOString(),
	environment: {
		arch: arch(),
		browser: { name: "chromium", version: browserVersion },
		cpu: cpus()[0]?.model,
		logicalCpuCount: cpus().length,
		node: process.version,
		platform: platform(),
		release: release(),
		totalMemoryBytes: totalmem(),
	},
	git: { revision: revision.trim(), status: status.trimEnd().split("\n").filter(Boolean) },
	mode: smoke ? "smoke" : precision ? "precision" : "measurement",
	protocol: {
		conditionOrdering: "counterbalanced independently for every workload",
		conditions,
		independentUnit: "fresh Chromium process for one condition/workload/pair",
		pairCount,
		practicalThresholds: { median: 1.05, p95: 1.1 },
		precisionPreflight: {
			independentProcesses: true,
			recordedPerWorkload: 5,
			threshold: "every observation must be positive and at least 20 measured clock quanta",
			warmupsPerWorkload: 1,
		},
		validation: "cheap exact checks inside each operation; full validation after warmups and recorded blocks",
		workloads,
	},
	protocolRevision,
	schemaVersion: 2,
	...(smoke
		? { conditions: progress.smokeConditions }
		: precision
			? { conditions: progress.precisionConditions }
			: { pairs: progress.pairs }),
};
const resultPath = resolve(output, smoke ? "smoke.json" : precision ? "precision.json" : "results.json");

await writeFile(resultPath, `${JSON.stringify(result, null, 2)}\n`);
console.log(resultPath);

async function writeProgress() {
	await writeFile(
		progressPath,
		`${JSON.stringify(
			{
				buildManifestSha256: sha256(buildText),
				createdAt: new Date().toISOString(),
				mode: "measurement-progress",
				progress,
				protocolRevision,
				schemaVersion: 2,
			},
			null,
			2,
		)}\n`,
	);
}

async function runSmokeCondition(condition, buildMetadata) {
	const bundle = await verifiedBundle(buildMetadata);
	const browser = await chromium.launch({ headless: true });

	try {
		browserVersion ??= await browser.version();

		const context = await browser.newContext();

		await routeBenchmark(context);

		const result = { condition, workloads: {} };

		for (const workload of workloads) {
			progress.active.workload = workload.name;

			const state = await createPage(context, bundle);

			try {
				const observation = await invokeRun(state.page, workload);

				assertRunResult(observation, workload);

				const validation = await invokeValidation(state.page);

				assertSink(`${workload.name}/smoke`, validation);
				await invokeCleanup(state.page);
				assertNoErrors(state.errors, `${condition}/${workload.name}`);
				result.workloads[workload.name] = { observation, validation };
			} finally {
				await state.page.close();
			}
		}

		if (condition === "candidate") {
			const state = await createPage(context, bundle);

			try {
				result.publicContract = await state.page.evaluate(() =>
					globalThis.__templateBenchmark.validatePublicContract(),
				);
				assertNoErrors(state.errors, `${condition}/public-contract`);
			} finally {
				await state.page.close();
			}
		}

		await context.close();

		return result;
	} finally {
		await browser.close();
	}
}

async function runMeasuredCondition(condition, buildMetadata, workload) {
	const bundle = await verifiedBundle(buildMetadata);
	const browser = await chromium.launch({ headless: true });

	try {
		browserVersion ??= await browser.version();

		const context = await browser.newContext();

		await routeBenchmark(context);

		const result =
			workload.name === "first-mount"
				? await measureFirstMount(context, bundle, condition, workload)
				: await measureSteadyWorkload(context, bundle, condition, workload);

		await context.close();

		return result;
	} finally {
		await browser.close();
	}
}

async function measureFirstMount(context, bundle, condition, workload) {
	const observations = [];
	const validations = [];

	for (let sampleIndex = 0; sampleIndex < workload.recorded; ++sampleIndex) {
		const state = await createPage(context, bundle);

		try {
			const clockQuantumMs = await measureClockQuantum(state.page);
			const observation = await invokeRun(state.page, workload);

			assertRunResult(observation, workload);

			const validation = await invokeValidation(state.page);

			assertSink(`${workload.name}/recorded`, validation);
			validations.push(validation);
			observations.push({
				...observation,
				clockLimited: observation.ms === 0 || observation.ms < 20 * clockQuantumMs,
				clockQuantumMs,
			});
			await invokeCleanup(state.page);
			assertNoErrors(state.errors, `${condition}/${workload.name}/${sampleIndex}`);
		} finally {
			await state.page.close();
		}
	}

	return {
		iterations: workload.iterations,
		observations,
		precision: {
			acceptanceEligible: false,
			clockLimitedSamples: observations.filter(({ clockLimited }) => clockLimited).length,
			reason: "Cold one-element samples are descriptive; separate pages cannot overcome single-operation timer limits.",
		},
		summary: summarize(observations),
		validations,
		warmups: [],
	};
}

async function measureSteadyWorkload(context, bundle, condition, workload) {
	const state = await createPage(context, bundle);

	try {
		const clockQuantumMs = await measureClockQuantum(state.page);
		const warmups = [];
		const observations = [];

		for (let index = 0; index < workload.warmups; ++index) {
			const observation = await invokeRun(state.page, workload);

			assertRunResult(observation, workload);
			warmups.push({ ...observation, clockQuantumMs });
		}

		const warmupValidation = await invokeValidation(state.page);

		assertSink(`${workload.name}/warmup`, warmupValidation);

		for (let index = 0; index < workload.recorded; ++index) {
			const observation = await invokeRun(state.page, workload);

			assertRunResult(observation, workload);

			if (observation.ms === 0 || observation.ms < 20 * clockQuantumMs) {
				throw new Error(
					`${condition}/${workload.name} sample ${index} measured ${observation.ms} ms, below 20 clock quanta (${20 * clockQuantumMs} ms)`,
				);
			}

			observations.push({ ...observation, clockQuantumMs });
		}

		const recordedValidation = await invokeValidation(state.page);

		assertSink(`${workload.name}/recorded`, recordedValidation);
		await invokeCleanup(state.page);
		assertNoErrors(state.errors, `${condition}/${workload.name}`);

		return {
			iterations: workload.iterations,
			observations,
			precision: { acceptanceEligible: true, minimumClockQuanta: 20 },
			summary: summarize(observations),
			validations: { recorded: recordedValidation, warmup: warmupValidation },
			warmups,
		};
	} finally {
		await state.page.close();
	}
}

async function createPage(context, bundle) {
	const page = await context.newPage();
	const errors = [];

	page.on("console", (message) => {
		if (message.type() === "error") {
			errors.push(`console: ${message.text()}`);
		}
	});
	page.on("pageerror", (error) => errors.push(`page: ${error.message}`));
	await page.goto(origin);
	await page.addScriptTag({ content: bundle });

	return { errors, page };
}

async function routeBenchmark(context) {
	await context.route(`${origin}**`, async (route) => {
		await route.fulfill({
			body: '<!doctype html><html><head><meta charset="utf-8"></head><body></body></html>',
			contentType: "text/html",
			status: 200,
		});
	});
}

async function measureClockQuantum(page) {
	return page.evaluate(() => {
		const deltas = [];
		let before = performance.now();

		while (deltas.length < 64) {
			const after = performance.now();

			if (after > before) {
				deltas.push(after - before);
				before = after;
			}
		}

		return Math.min(...deltas);
	});
}

async function invokeRun(page, workload) {
	return page.evaluate(async ({ iterations, name }) => {
		const benchmark = globalThis.__templateBenchmark;

		if (
			!benchmark ||
			typeof benchmark.run !== "function" ||
			typeof benchmark.validate !== "function" ||
			typeof benchmark.cleanup !== "function"
		) {
			throw new TypeError("Fixture did not install the __templateBenchmark API");
		}

		return benchmark.run(name, iterations);
	}, workload);
}

function invokeValidation(page) {
	return page.evaluate(() => globalThis.__templateBenchmark.validate());
}

function invokeCleanup(page) {
	return page.evaluate(() => globalThis.__templateBenchmark.cleanup());
}

async function verifiedBundle(buildMetadata) {
	const code = await readFile(buildMetadata.bundle.path, "utf8");

	if (sha256(code) !== buildMetadata.bundle.sha256) {
		throw new Error(`Bundle hash mismatch for ${buildMetadata.condition}`);
	}

	return code;
}

function assertBuildManifest(value) {
	if (
		value.schemaVersion !== 2 ||
		value.protocolRevision !== protocolRevision ||
		JSON.stringify(value.conditions) !== JSON.stringify(conditions) ||
		conditions.some((condition) => value.builds?.[condition]?.condition !== condition)
	) {
		throw new Error("Build manifest does not match template benchmark protocol revision 4");
	}
}

function assertRunResult(observation, workload) {
	if (
		!observation ||
		!Number.isFinite(observation.ms) ||
		observation.ms < 0 ||
		observation.operations !== workload.operations
	) {
		throw new Error(`Unexpected ${workload.name} observation: ${JSON.stringify(observation)}`);
	}
}

function assertSink(key, value) {
	const serialized = JSON.stringify(value);
	const expected = expectedSinks.get(key);

	if (expected === undefined) {
		expectedSinks.set(key, serialized);
	} else if (serialized !== expected) {
		throw new Error(`Semantic sink mismatch for ${key}: expected ${expected}; received ${serialized}`);
	}
}

function assertNoErrors(errors, label) {
	if (errors.length > 0) {
		throw new Error(`Browser errors in ${label}: ${errors.join(" | ")}`);
	}
}

function summarize(observations) {
	const values = observations.map(({ ms }) => ms).toSorted((left, right) => left - right);

	return {
		maximumMs: values.at(-1),
		medianMs: percentile(values, 0.5),
		minimumMs: values[0],
		p95Ms: percentile(values, 0.95),
		sampleCount: values.length,
	};
}

function percentile(sorted, proportion) {
	return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * proportion) - 1)];
}

function parseArguments(values) {
	const parsed = {};

	for (let index = 0; index < values.length; ++index) {
		const argument = values[index];

		if (!argument.startsWith("--")) {
			throw new Error(`Unexpected argument: ${argument}`);
		}

		const key = argument.slice(2);

		if (["smoke", "precision", "confirmed-quiet-slot"].includes(key)) {
			parsed[key] = true;
			continue;
		}

		if (!values[index + 1] || values[index + 1].startsWith("--")) {
			throw new Error(`Expected a value after ${argument}`);
		}

		parsed[key] = values[++index];
	}

	return parsed;
}
