import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const arguments_ = parseArguments(process.argv.slice(2));
const inputPath = arguments_._[0];
const outputPath = arguments_.output;

if (!inputPath) {
	throw new Error("Usage: node analyze.mjs <results.json> [--output <analysis.json>]");
}

const input = JSON.parse(await readFile(resolve(inputPath), "utf8"));
const conditions = ["baseline", "candidate"];

if (
	input.mode !== "measurement" ||
	input.protocolRevision !== 4 ||
	input.protocol?.pairCount !== 8 ||
	input.pairs?.length !== 8 ||
	JSON.stringify(input.protocol.conditions) !== JSON.stringify(conditions)
) {
	throw new Error("Expected one complete revision-4 measurement with exactly eight paired runs");
}

const analyses = {};

for (const workload of input.protocol.workloads) {
	const pairs = input.pairs.map((pair) => pair.workloads[workload.name]);

	if (
		pairs.some(
			(pair) =>
				!pair ||
				conditions.some(
					(condition) =>
						pair.results?.[condition]?.summary?.sampleCount !== workload.recorded ||
						pair.results[condition].observations.length !== workload.recorded,
				),
		)
	) {
		throw new Error(`Incomplete ${workload.name} process pair`);
	}

	const clockLimitedSamples = Object.fromEntries(
		conditions.map((condition) => [
			condition,
			pairs.reduce((total, pair) => total + (pair.results[condition].precision.clockLimitedSamples ?? 0), 0),
		]),
	);
	const medianRatios = pairs.map(
		({ results }) => results.baseline.summary.medianMs / results.candidate.summary.medianMs,
	);
	const p95Ratios = pairs.map(({ results }) => results.baseline.summary.p95Ms / results.candidate.summary.p95Ms);

	analyses[workload.name] = {
		acceptanceEligible: workload.acceptanceEligible,
		absoluteMs: Object.fromEntries(
			conditions.map((condition) => {
				const summaries = pairs.map(({ results }) => results[condition].summary);

				return [
					condition,
					{
						medianOfProcessMedians: percentile(
							summaries.map(({ medianMs }) => medianMs).toSorted((left, right) => left - right),
							0.5,
						),
						medianOfProcessP95s: percentile(
							summaries.map(({ p95Ms }) => p95Ms).toSorted((left, right) => left - right),
							0.5,
						),
					},
				];
			}),
		),
		clockLimitedSamples,
		median: studentTInterval(medianRatios, workload.acceptanceEligible ? 1.05 : undefined),
		p95: studentTInterval(p95Ratios, workload.acceptanceEligible ? 1.1 : undefined),
	};
}

const acceptanceWorkloads = Object.entries(analyses).filter(([, analysis]) => analysis.acceptanceEligible);
const primary = analyses["mount-1000"];
const acceptance = {
	criteria: {
		primaryMedian: "mount-1000 median interval must be entirely above 1.05",
		secondaryMedians: "update, reconnect, and move median intervals must be entirely above 1/1.05",
		tails: "every acceptance workload p95 interval must be entirely above 1/1.10",
	},
	passed:
		primary?.median.status === "credible-win" &&
		acceptanceWorkloads.every(
			([name, analysis]) =>
				(name === "mount-1000" || analysis.median.status !== "material-regression") &&
				analysis.median.status !== "inconclusive" &&
				analysis.p95.status !== "material-regression" &&
				analysis.p95.status !== "inconclusive",
		),
};

const analysis = {
	acceptance,
	buildManifestSha256: input.buildManifestSha256,
	bundleWeights: Object.fromEntries(conditions.map((condition) => [condition, input.build.builds[condition].bundle])),
	createdAt: new Date().toISOString(),
	direction: "Ratios are baseline latency divided by candidate latency; values above one favor the candidate.",
	input: resolve(inputPath),
	method: {
		independentPairs: 8,
		medianPracticalThreshold: 1.05,
		p95PracticalThreshold: 1.1,
		statistics: "paired geometric ratios with two-sided 95% Student-t intervals over log ratios",
		withinProcessRecordedSamples: 40,
	},
	protocolRevision: 4,
	workloads: analyses,
};
const serialized = `${JSON.stringify(analysis, null, 2)}\n`;

if (outputPath) {
	await writeFile(resolve(outputPath), serialized);
}

console.log(serialized.trimEnd());

function studentTInterval(ratios, practicalThreshold) {
	const logs = ratios.map(Math.log);
	const mean = logs.reduce((total, value) => total + value, 0) / logs.length;
	const variance = logs.reduce((total, value) => total + (value - mean) ** 2, 0) / (logs.length - 1);
	const critical95Df7 = 2.3646242510102993;
	const margin = critical95Df7 * Math.sqrt(variance / logs.length);
	const interval95 = [Math.exp(mean - margin), Math.exp(mean + margin)];

	return {
		geometricMeanRatio: Math.exp(mean),
		interval95,
		pairRatios: ratios,
		status:
			practicalThreshold === undefined
				? "descriptive"
				: interval95[0] > practicalThreshold
					? "credible-win"
					: interval95[1] < 1 / practicalThreshold
						? "material-regression"
						: interval95[0] > 1 / practicalThreshold
							? "no-material-regression-practical-win-unresolved"
							: "inconclusive",
		statisticalDirection:
			interval95[0] > 1 ? "candidate-faster" : interval95[1] < 1 ? "candidate-slower" : "unresolved",
		studentT: { critical95: critical95Df7, degreesOfFreedom: 7 },
	};
}

function percentile(sorted, proportion) {
	return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * proportion) - 1)];
}

function parseArguments(values) {
	const parsed = { _: [] };

	for (let index = 0; index < values.length; ++index) {
		const argument = values[index];

		if (!argument.startsWith("--")) {
			parsed._.push(argument);
			continue;
		}

		if (!values[index + 1] || values[index + 1].startsWith("--")) {
			throw new Error(`Expected a value after ${argument}`);
		}

		parsed[argument.slice(2)] = values[++index];
	}

	return parsed;
}
