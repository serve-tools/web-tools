import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { sha256, writeHashedJSON } from "./integrity.mjs";

const arguments_ = parseArguments(process.argv.slice(2));
if (!arguments_.input || !arguments_.output) {
	throw new Error("Usage: node analyze.mjs --input <results.json> --output <analysis.json>");
}

const inputPath = resolve(arguments_.input);
const inputText = await readFile(inputPath, "utf8");
const input = JSON.parse(inputText);
if (input.status !== "complete") {
	throw new Error(`Cannot analyze a ${input.status} run`);
}

const tCritical95 = { 4: 2.776, 5: 2.571, 6: 2.447, 7: 2.365, 8: 2.306, 9: 2.262, 10: 2.228 };
const analysis = {
	buildMetadataSha256: input.buildMetadataSha256,
	createdAt: new Date().toISOString(),
	independentPairs: input.protocol.pairCount,
	inputPath,
	inputSha256: sha256(inputText),
	protocolRevision: input.protocolRevision,
	results: {},
	schemaVersion: 1,
	thresholds: input.protocol.practicalThresholds,
};

for (const workload of input.protocol.workloads) {
	analysis.results[workload.id] = {};
	for (const metric of input.protocol.metrics) {
		const paired = input.pairs.map((pair) => {
			const results = pair.workloads[workload.id].results;
			const base = results.base.observations.map((observation) => observation[metric.field]);
			const baseUI = results["base-ui"].observations.map((observation) => observation[metric.field]);
			const baseMedianMs = median(base);
			const baseUIMedianMs = median(baseUI);
			const baseP95Ms = nearestRank(base, 0.95);
			const baseUIP95Ms = nearestRank(baseUI, 0.95);
			return {
				baseMedianMs,
				baseP95Ms,
				baseUIMedianMs,
				baseUIP95Ms,
				medianRatio: baseUIMedianMs / baseMedianMs,
				p95Ratio: baseUIP95Ms / baseP95Ms,
				pairIndex: pair.pairIndex,
			};
		});
		analysis.results[workload.id][metric.id] = {
			absoluteRunSummaryMs: {
				base: {
					median: median(paired.map((pair) => pair.baseMedianMs)),
					p95: median(paired.map((pair) => pair.baseP95Ms)),
				},
				baseUI: {
					median: median(paired.map((pair) => pair.baseUIMedianMs)),
					p95: median(paired.map((pair) => pair.baseUIP95Ms)),
				},
			},
			median: compare(
				paired.map((pair) => pair.medianRatio),
				input.protocol.practicalThresholds.medianNoRegressionRatio,
			),
			p95: compare(
				paired.map((pair) => pair.p95Ratio),
				input.protocol.practicalThresholds.p95NoRegressionRatio,
			),
			pairs: paired,
			units: "milliseconds per operation",
		};
	}
}

analysis.passed = Object.values(analysis.results).every((workload) =>
	Object.values(workload).every(
		(result) =>
			result.median.classification === "no-material-regression-resolved" &&
			result.p95.classification === "no-material-regression-resolved",
	),
);
const artifact = await writeHashedJSON(resolve(arguments_.output), analysis);
console.log(JSON.stringify({ artifact, passed: analysis.passed }, null, 2));

function compare(ratios, threshold) {
	if (ratios.some((ratio) => !(ratio > 0) || !Number.isFinite(ratio))) {
		return { classification: "inconclusive-measurement-floor", geometricMean: null, interval95: null, threshold };
	}
	const logs = ratios.map(Math.log);
	const average = mean(logs);
	const degreesOfFreedom = logs.length - 1;
	const critical = tCritical95[degreesOfFreedom];
	if (!critical) {
		throw new Error(`No 95% t critical value for ${degreesOfFreedom} degrees of freedom`);
	}
	const margin = (critical * sampleSD(logs)) / Math.sqrt(logs.length);
	const interval95 = { high: Math.exp(average + margin), low: Math.exp(average - margin) };
	const classification =
		interval95.low > threshold
			? "no-material-regression-resolved"
			: interval95.high < threshold
				? "resolved-material-regression"
				: "inconclusive-at-boundary";
	return { classification, geometricMean: Math.exp(average), interval95, threshold };
}

function median(values) {
	const sorted = values.toSorted((left, right) => left - right);
	const middle = Math.floor(sorted.length / 2);
	return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle];
}

function nearestRank(values, probability) {
	return values.toSorted((left, right) => left - right)[Math.ceil(probability * values.length) - 1];
}

function mean(values) {
	return values.reduce((total, value) => total + value, 0) / values.length;
}

function sampleSD(values) {
	const average = mean(values);
	return Math.sqrt(values.reduce((total, value) => total + (value - average) ** 2, 0) / (values.length - 1));
}

function parseArguments(values) {
	const parsed = {};
	for (let index = 0; index < values.length; ++index) {
		const argument = values[index];
		if (!argument.startsWith("--") || !values[index + 1] || values[index + 1].startsWith("--")) {
			throw new Error(`Expected a value after ${argument}`);
		}
		parsed[argument.slice(2)] = values[++index];
	}
	return parsed;
}
