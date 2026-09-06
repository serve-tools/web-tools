import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const arguments_ = parseArguments(process.argv.slice(2));
const inputPath = arguments_.input;
const outputPath = arguments_.output;
if (!inputPath || !outputPath) {
	throw new Error("Usage: node analyze.mjs --input <results.json> --output <analysis.json>");
}

const inputText = await readFile(resolve(inputPath), "utf8");
const input = JSON.parse(inputText);
if (input.status !== "complete") {
	throw new Error(`Cannot analyze a ${input.status} run`);
}

const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const tCritical95 = {
	4: 2.776,
	5: 2.571,
	6: 2.447,
	7: 2.365,
	8: 2.306,
	9: 2.262,
	10: 2.228,
};
const analysis = {
	buildMetadataSha256: input.buildMetadataSha256,
	createdAt: new Date().toISOString(),
	independentPairs: input.protocol.pairCount,
	inputPath: resolve(inputPath),
	inputSha256: sha256(inputText),
	protocolRevision: input.protocolRevision,
	results: {},
	schemaVersion: 1,
	thresholds: input.protocol.practicalThresholds,
};

for (const workload of input.protocol.workloads) {
	const paired = input.pairs.map((pair) => {
		const results = pair.workloads[workload.id].results;
		const base = results.base.observations.map((observation) => observation.durationMs);
		const baseUI = results["base-ui"].observations.map((observation) => observation.durationMs);
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
	const medianComparison = compare(
		paired.map((pair) => pair.medianRatio),
		input.protocol.practicalThresholds.medianNoRegressionRatio,
	);
	const p95Comparison = compare(
		paired.map((pair) => pair.p95Ratio),
		input.protocol.practicalThresholds.p95NoRegressionRatio,
	);
	analysis.results[workload.id] = {
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
		median: medianComparison,
		p95: p95Comparison,
		pairs: paired,
		units:
			workload.id === "update-one-1000" || workload.id === "update-100-1000"
				? "mean milliseconds per completed operation within fixed sequential blocks"
				: "milliseconds per operation",
	};
}

analysis.passed = Object.values(analysis.results).every(
	(result) =>
		result.median.classification === "no-material-regression-resolved" &&
		result.p95.classification === "no-material-regression-resolved",
);
await writeFile(resolve(outputPath), `${JSON.stringify(analysis, null, 2)}\n`);
await writeFile(resolve(outputPath).replace(/\.json$/, ".md"), renderMarkdown(analysis));
console.log(resolve(outputPath));

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
	const sorted = values.toSorted((left, right) => left - right);
	return sorted[Math.ceil(probability * sorted.length) - 1];
}

function mean(values) {
	return values.reduce((total, value) => total + value, 0) / values.length;
}

function sampleSD(values) {
	const average = mean(values);
	return Math.sqrt(values.reduce((total, value) => total + (value - average) ** 2, 0) / (values.length - 1));
}

function renderMarkdown(value) {
	const rows = Object.entries(value.results).map(([id, result]) => {
		const medianInterval = result.median.interval95;
		const p95Interval = result.p95.interval95;
		return `| ${id} | ${result.absoluteRunSummaryMs.base.median.toFixed(4)} | ${result.absoluteRunSummaryMs.baseUI.median.toFixed(4)} | ${formatRatio(result.median.geometricMean, medianInterval)} | ${formatRatio(result.p95.geometricMean, p95Interval)} | ${result.median.classification}; ${result.p95.classification} |`;
	});
	return `# Contemporary Base / pinned Base UI Checkbox analysis\n\nRaw evidence: \`${value.inputPath}\`  \nRaw SHA-256: \`${value.inputSha256}\`\n\nRatios are Base UI / Base latency, so values above one favor Base.\nIntervals use the eight fresh paired Chromium process summaries as independent units.\nThe isolated-update values are exact-1,000 sequential block means, and the 100-control update values are exact-20 sequential block means.\nTheir p95 values describe block means, not individual interaction or batch tails.\n\n| Workload | Base run median ms | Base UI run median ms | Median ratio and 95% interval | P95 ratio and 95% interval | Classification |\n| --- | ---: | ---: | ---: | ---: | --- |\n${rows.join("\n")}\n\nThis result applies only to the fixed Checkbox fixtures and JavaScript completion boundaries in the protocol.\nIt excludes paint, input-to-screen latency, assistive-technology operation, retention, and whole-library performance.\n`;
}

function formatRatio(ratio, interval) {
	return ratio === null || interval === null
		? "not estimable"
		: `${ratio.toFixed(3)} (${interval.low.toFixed(3)}–${interval.high.toFixed(3)})`;
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
