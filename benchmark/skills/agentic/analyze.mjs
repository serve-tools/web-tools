#!/usr/bin/env node

import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const comparisons = [
	["current", "docs"],
	["minimal", "docs"],
	["minimal", "current"],
];

/** Summarizes a completed agentic evaluation without changing its primary report. */
export function analyze(records, { plan = {}, report = {} } = {}) {
	const variants = plan.metadata?.variants ?? [...new Set(records.map((record) => record.variant))].sort();
	const seeds =
		plan.metadata?.seeds ?? [...new Set(records.map((record) => record.seed))].sort((left, right) => left - right);
	const plannedAttempts = plan.metadata?.plannedAttempts ?? records.length;
	const conditionSeeds = variants.flatMap((variant) =>
		seeds.map((seed) =>
			summarizeConditionSeed(records, variant, seed, plannedAttempts, variants.length * seeds.length),
		),
	);
	const conditionSuccess = variants.map((variant) => summarizeSuccess(records, variant));
	const paired = comparisons.map(([left, right]) => summarizeComparison(records, left, right, seeds));

	return {
		metadata: {
			completedPlan:
				report.metadata?.completedPlan ?? plan.metadata?.completedPlan ?? records.length === plannedAttempts,
			plannedAttempts,
			records: records.length,
			seeds,
			variants,
		},
		conditionSeeds,
		conditionSuccess,
		paired,
	};
}

/** Renders the supplemental analysis as an explicitly descriptive Markdown report. */
export function renderAnalysis(analysis) {
	const lines = [
		"# Agentic evaluation supplemental analysis",
		"",
		"All attempts remain in success and elapsed-time denominators.",
		"Token lower bounds retain observed partial usage, while token inference is unavailable for a comparison with incomplete usage.",
		"Success intervals are clipped task-clustered t intervals; paired intervals use task means as clusters and remain unbounded.",
		"Repetitions and allocation-order seeds are not independent tasks.",
		"",
		"## Condition and seed accounting",
		"",
		"| Condition | Seed | Attempts | Success | Observed lower-bound total / uncached tokens | Lower-bound mean total / uncached tokens | Mean elapsed | Successful copy_file attempts / copies | Statuses | Usage complete / incomplete / missing |",
		"| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- | ---: |",
	];

	for (const row of analysis.conditionSeeds) {
		lines.push(
			`| ${row.variant} | ${row.seed} | ${row.attempts} | ${formatPercent(row.success.rate)} | ${row.usage.observedTotalTokens.toLocaleString("en-US")} / ${row.usage.observedUncachedTokens.toLocaleString("en-US")} | ${formatMean(row.cost.meanTotalTokens)} / ${formatMean(row.cost.meanUncachedTokens)} | ${formatMilliseconds(row.cost.meanElapsedMs)} | ${row.copies.attempts} / ${row.copies.count} | ${formatCounts(row.statuses)} | ${row.usage.complete} / ${row.usage.incomplete} / ${row.usage.missing} |`,
		);
	}

	lines.push(
		"",
		"## Success and failure stages",
		"",
		"| Condition | Success (task-clustered 95% CI) | Failure stages |",
		"| --- | ---: | --- |",
	);

	for (const row of analysis.conditionSuccess) {
		lines.push(`| ${row.variant} | ${formatEstimate(row.success)} | ${formatCounts(row.failureStages)} |`);
	}

	lines.push(
		"",
		"## Descriptive workflow timing",
		"",
		"Time to first artifact write includes initial generation as well as document discovery.",
		"Time after first failed public check begins after that check returns; neither metric assigns a causal phase of total elapsed time.",
		"",
		"| Condition | Seed | Time to first artifact write | Time after first failed public check |",
		"| --- | ---: | ---: | ---: |",
	);

	for (const row of analysis.conditionSeeds) {
		lines.push(
			`| ${row.variant} | ${row.seed} | ${formatTiming(row.workflowTiming.timeToFirstArtifactWrite)} | ${formatTiming(row.workflowTiming.timeAfterFirstFailedPublicCheck)} |`,
		);
	}

	lines.push(
		"",
		"## Paired comparisons",
		"",
		"Positive success differences favor the left condition. Negative elapsed differences favor the left condition.",
		"Relative token and elapsed changes are geometric task-mean ratios: a negative value favors the left condition.",
		"",
		"| Comparison | Seed | Complete pairs | Success difference | Total tokens | Uncached tokens | Elapsed |",
		"| --- | ---: | ---: | ---: | ---: | ---: | ---: |",
	);

	for (const comparison of analysis.paired) {
		for (const seed of comparison.bySeed) {
			lines.push(
				`| ${comparison.left} − ${comparison.right} | ${seed.seed} | ${seed.completePairs}/${seed.attemptedPairs} | ${formatEstimate(seed.successDifference, formatPercentagePoints)} | ${formatTokenEstimate(seed.totalTokenDifference)} | ${formatTokenEstimate(seed.uncachedTokenDifference)} | ${formatEstimate(seed.elapsedDifference, formatMilliseconds)} |`,
			);
		}
		lines.push(
			`| ${comparison.left} − ${comparison.right} pooled relative | all | ${comparison.pairCompleteness.completePairs}/${comparison.pairCompleteness.attemptedPairs} | — | ${formatRatioEstimate(comparison.relative.totalTokens)} | ${formatRatioEstimate(comparison.relative.uncachedTokens)} | ${formatRatioEstimate(comparison.relative.elapsedMs)} |`,
		);
	}

	lines.push(
		"",
		"## Operational cost per success",
		"",
		"| Condition | Elapsed per success | Observed uncached tokens per success |",
		"| --- | ---: | ---: |",
	);

	for (const row of analysis.conditionSuccess) {
		lines.push(
			`| ${row.variant} | ${formatMean(row.operational.elapsedPerSuccessMs, formatMilliseconds)} | ${formatMean(row.operational.observedUncachedPerSuccess)} |`,
		);
	}

	return `${lines.join("\n")}\n`;
}

function summarizeConditionSeed(records, variant, seed, plannedAttempts, divisor) {
	const group = records.filter((record) => record.variant === variant && record.seed === seed);
	const expectedAttempts = Math.floor(plannedAttempts / divisor);
	const usage = summarizeUsage(group);
	const successes = group.filter((record) => record.pass).length;

	return {
		variant,
		seed,
		attempts: group.length,
		expectedAttempts,
		success: { count: successes, rate: rate(successes, group.length) },
		statuses: countBy(group, (record) => record.status ?? "missing-status"),
		usage,
		cost: {
			meanElapsedMs: mean(group.map((record) => number(record.elapsedMs))),
			meanTotalTokens: usage.observedTotalTokens / group.length,
			meanUncachedTokens: usage.observedUncachedTokens / group.length,
		},
		workflowTiming: {
			timeToFirstArtifactWrite: descriptiveTiming(group, "discoveryToFirstWriteMs"),
			timeAfterFirstFailedPublicCheck: descriptiveTiming(group, "repairAfterFirstFailureMs", (record) =>
				record.checkResults?.some((check) => !check.compile || !check.smoke),
			),
		},
		copies: {
			attempts: group.filter((record) => number(record.copies) > 0).length,
			count: group.reduce((sum, record) => sum + (number(record.copies) || 0), 0),
		},
	};
}

function summarizeSuccess(records, variant) {
	const group = records.filter((record) => record.variant === variant);
	const successes = group.filter((record) => record.pass).length;
	const elapsed = group.reduce((sum, record) => sum + number(record.elapsedMs), 0);
	const usage = summarizeUsage(group);
	const taskRates = groupBy(group, (record) => record.taskId).map((taskRecords) =>
		rate(taskRecords.filter((record) => record.pass).length, taskRecords.length),
	);

	return {
		variant,
		attempts: group.length,
		success: clipRateEstimate(estimate(taskRates)),
		failureStages: failureStages(group),
		operational: {
			elapsedPerSuccessMs: successes === 0 ? null : elapsed / successes,
			observedUncachedPerSuccess: successes === 0 ? null : usage.observedUncachedTokens / successes,
		},
	};
}

function summarizeComparison(records, left, right, seeds) {
	const allPairs = findPairs(records, left, right);
	const pairCompleteness = summarizePairs(allPairs);
	const bySeed = seeds.map((seed) => summarizePairDeltas(allPairs.filter((pair) => pair.seed === seed)));
	const completeUsage = pairCompleteness.incompleteUsagePairs === 0 && pairCompleteness.missingUsagePairs === 0;

	return {
		left,
		right,
		pairCompleteness,
		bySeed,
		relative: {
			totalTokens: completeUsage ? relativeTaskRatios(allPairs, "totalTokens") : unavailable(),
			uncachedTokens: completeUsage ? relativeTaskRatios(allPairs, "uncachedTokens") : unavailable(),
			elapsedMs: relativeTaskRatios(allPairs, "elapsedMs"),
		},
	};
}

function findPairs(records, left, right) {
	const indexed = new Map();

	for (const record of records) {
		if (record.variant !== left && record.variant !== right) {
			continue;
		}
		const key = `${record.taskId}\0${record.seed}\0${record.run}`;
		const pair = indexed.get(key) ?? { key, taskId: record.taskId, seed: record.seed, run: record.run };
		pair[record.variant === left ? "left" : "right"] = record;
		indexed.set(key, pair);
	}

	return [...indexed.values()];
}

function summarizePairs(pairs) {
	let completePairs = 0;
	let incompleteUsagePairs = 0;
	let missingUsagePairs = 0;

	for (const pair of pairs) {
		if (pair.left === undefined || pair.right === undefined) {
			continue;
		}
		++completePairs;
		const usages = [pair.left.usage, pair.right.usage];
		if (usages.some((usage) => usage === null || usage === undefined)) {
			++missingUsagePairs;
		} else if (pair.left.usageComplete === false || pair.right.usageComplete === false) {
			++incompleteUsagePairs;
		}
	}

	return { attemptedPairs: pairs.length, completePairs, incompleteUsagePairs, missingUsagePairs };
}

function summarizePairDeltas(pairs) {
	const complete = pairs.filter((pair) => pair.left !== undefined && pair.right !== undefined);
	const usageComplete = complete.filter((pair) => completeUsage(pair.left) && completeUsage(pair.right));
	const taskDeltas = (field, source = complete) =>
		groupBy(source, (pair) => pair.taskId).map((taskPairs) =>
			mean(taskPairs.map((pair) => metric(pair.left, field) - metric(pair.right, field))),
		);

	return {
		seed: pairs[0]?.seed ?? null,
		attemptedPairs: pairs.length,
		completePairs: complete.length,
		successDifference: estimate(taskDeltas("pass")),
		totalTokenDifference:
			complete.length === usageComplete.length
				? estimate(taskDeltas("totalTokens", usageComplete))
				: unavailable(),
		uncachedTokenDifference:
			complete.length === usageComplete.length
				? estimate(taskDeltas("uncachedTokens", usageComplete))
				: unavailable(),
		elapsedDifference: estimate(taskDeltas("elapsedMs")),
	};
}

function relativeTaskRatios(pairs, field) {
	const complete = pairs.filter((pair) => pair.left !== undefined && pair.right !== undefined);
	const logRatios = groupBy(complete, (pair) => pair.taskId).map((taskPairs) => {
		const left = mean(taskPairs.map((pair) => metric(pair.left, field)));
		const right = mean(taskPairs.map((pair) => metric(pair.right, field)));
		return left > 0 && right > 0 ? Math.log(left / right) : Number.NaN;
	});

	if (logRatios.some((value) => !Number.isFinite(value))) {
		return unavailable();
	}

	const estimateValue = estimate(logRatios);
	return {
		mean: Math.exp(estimateValue.mean) - 1,
		interval: estimateValue.interval?.map((value) => Math.exp(value) - 1),
		clusters: logRatios.length,
	};
}

function summarizeUsage(records) {
	const observed = records.flatMap((record) => {
		if (!record.usage || !finiteUsage(record.usage)) {
			return [];
		}
		return [
			{
				totalTokens: record.usage.inputTokens + record.usage.outputTokens,
				uncachedTokens: record.usage.inputTokens - record.usage.cachedInputTokens + record.usage.outputTokens,
			},
		];
	});
	const complete = records.filter((record) => completeUsage(record)).length;
	const incomplete = records.filter((record) => record.usage && record.usageComplete === false).length;
	const missing = records.length - complete - incomplete;

	return {
		complete,
		incomplete,
		missing,
		observed,
		observedTotalTokens: observed.reduce((sum, entry) => sum + entry.totalTokens, 0),
		observedUncachedTokens: observed.reduce((sum, entry) => sum + entry.uncachedTokens, 0),
	};
}

function completeUsage(record) {
	return record.usageComplete !== false && finiteUsage(record.usage);
}

function finiteUsage(usage) {
	return [usage?.inputTokens, usage?.cachedInputTokens, usage?.outputTokens].every(Number.isFinite);
}

function failureStages(records) {
	const stages = {
		incomplete: 0,
		artifactPassIncomplete: 0,
		compile: 0,
		contracts: 0,
		smoke: 0,
		hidden: 0,
		completedFailure: 0,
	};

	for (const record of records) {
		if (record.pass) {
			continue;
		}
		if (record.status !== "completed") {
			++stages.incomplete;
			if (
				record.grade?.compile &&
				record.grade?.contracts !== false &&
				record.grade?.smoke &&
				record.grade?.hidden
			) {
				++stages.artifactPassIncomplete;
			}
			continue;
		}
		if (!record.grade?.compile) {
			++stages.compile;
		} else if (record.grade?.contracts === false) {
			++stages.contracts;
		} else if (!record.grade?.smoke) {
			++stages.smoke;
		} else if (!record.grade?.hidden) {
			++stages.hidden;
		} else {
			++stages.completedFailure;
		}
	}

	return Object.fromEntries(Object.entries(stages).filter(([, count]) => count > 0));
}

function descriptiveTiming(records, field, include = () => true) {
	const values = records
		.filter(include)
		.map((record) => record[field])
		.filter(Number.isFinite);
	return { count: values.length, mean: mean(values) };
}

function metric(record, field) {
	if (field === "pass") {
		return Number(record.pass);
	}
	if (field === "elapsedMs") {
		return number(record.elapsedMs);
	}
	if (field === "totalTokens") {
		return record.usage.inputTokens + record.usage.outputTokens;
	}
	return record.usage.inputTokens - record.usage.cachedInputTokens + record.usage.outputTokens;
}

function estimate(values) {
	const average = mean(values);
	if (values.length < 2 || !Number.isFinite(average)) {
		return { mean: average, interval: undefined, clusters: values.length };
	}
	const variance = values.reduce((sum, value) => sum + (value - average) ** 2, 0) / (values.length - 1);
	const margin = tCritical95(values.length - 1) * Math.sqrt(variance / values.length);
	return { mean: average, interval: [average - margin, average + margin], clusters: values.length };
}

function unavailable() {
	return { mean: Number.NaN, interval: undefined, clusters: 0 };
}

function clipRateEstimate(estimateValue) {
	return {
		...estimateValue,
		interval: estimateValue.interval?.map((value) => Math.max(0, Math.min(1, value))),
	};
}

function tCritical95(degreesOfFreedom) {
	return (
		[
			12.706, 4.303, 3.182, 2.776, 2.571, 2.447, 2.365, 2.306, 2.262, 2.228, 2.201, 2.179, 2.16, 2.145, 2.131,
			2.12, 2.11, 2.101, 2.093, 2.086, 2.08, 2.074, 2.069, 2.064, 2.06, 2.056, 2.052, 2.048, 2.045, 2.042,
		][degreesOfFreedom - 1] ?? 1.96
	);
}

function groupBy(values, keyOf) {
	const groups = new Map();
	for (const value of values) {
		const key = keyOf(value);
		const group = groups.get(key) ?? [];
		group.push(value);
		groups.set(key, group);
	}
	return [...groups.values()];
}

function countBy(values, keyOf) {
	return Object.fromEntries(groupBy(values, keyOf).map((group) => [keyOf(group[0]), group.length]));
}

function mean(values) {
	return values.length === 0 ? Number.NaN : values.reduce((sum, value) => sum + value, 0) / values.length;
}

function rate(numerator, denominator) {
	return denominator === 0 ? Number.NaN : numerator / denominator;
}

function number(value) {
	return Number.isFinite(value) ? value : Number.NaN;
}

function formatCounts(counts) {
	const entries = Object.entries(counts);
	return entries.length === 0 ? "—" : entries.map(([key, count]) => `${key}: ${count}`).join(", ");
}

function formatPercent(value) {
	return Number.isFinite(value) ? `${(value * 100).toFixed(1)}%` : "unavailable";
}

function formatPercentagePoints(value) {
	return Number.isFinite(value) ? `${(value * 100).toFixed(1)}pp` : "unavailable";
}

function formatMean(value, formatter = (number) => number.toFixed(0)) {
	return Number.isFinite(value) ? formatter(value) : "unavailable";
}

function formatMilliseconds(value) {
	return `${(value / 1_000).toFixed(1)}s`;
}

function formatEstimate(value, formatter = formatPercent) {
	if (!value || !Number.isFinite(value.mean)) {
		return "unavailable";
	}
	return `${formatter(value.mean)}${value.interval ? ` [${value.interval.map(formatter).join(", ")}]` : " (insufficient tasks)"}`;
}

function formatTokenEstimate(value) {
	return formatEstimate(value, (number) => number.toFixed(0));
}

function formatRatioEstimate(value) {
	return formatEstimate(value, (number) => `${(number * 100).toFixed(1)}%`);
}

function formatTiming(value) {
	return value.count === 0 ? "—" : `${formatMilliseconds(value.mean)} (n=${value.count})`;
}

async function main() {
	const input = argument(process.argv.slice(2), "--input");
	if (!input) {
		throw new Error("Usage: node benchmark/skills/agentic/analyze.mjs --input DIR");
	}
	const directory = path.resolve(input);
	const [recordsSource, planSource, reportSource] = await Promise.all([
		readFile(path.join(directory, "records.jsonl"), "utf8"),
		readFile(path.join(directory, "plan.json"), "utf8"),
		readFile(path.join(directory, "report.json"), "utf8"),
	]);
	const records = recordsSource.trim() === "" ? [] : recordsSource.trim().split("\n").map(JSON.parse);
	const analysis = analyze(records, { plan: JSON.parse(planSource), report: JSON.parse(reportSource) });
	const markdown = renderAnalysis(analysis);
	await Promise.all([
		writeFile(path.join(directory, "analysis.json"), `${JSON.stringify(analysis, null, 2)}\n`),
		writeFile(path.join(directory, "analysis.md"), markdown),
	]);
	process.stdout.write(markdown);
}

function argument(arguments_, name) {
	const index = arguments_.indexOf(name);
	return index === -1 ? undefined : arguments_[index + 1];
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
	main().catch((error) => {
		process.stderr.write(`${error.stack}\n`);
		process.exitCode = 1;
	});
}
