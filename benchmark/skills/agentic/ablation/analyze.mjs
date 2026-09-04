import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { auditPlannedIdentities } from "../transfer/analyze.mjs";
import { reuseEvidence } from "../transfer/reuse.mjs";
import { settings } from "./settings.mjs";
import { average, relativeInterval, signFlipInterval } from "./statistics.mjs";

export function analyze(records, plan) {
	const families = [...new Set(plan.tasks.map((task) => task.family))];
	const familyByTask = Object.fromEntries(plan.tasks.map((task) => [task.id, task.family]));
	const identity = auditPlannedIdentities(records, plan.jobs);
	const complete =
		plan.metadata.completedPlan === true &&
		plan.metadata.stopReason === null &&
		records.length === 192 &&
		identity.exact &&
		plan.jobs.length === 192 &&
		families.length === 12 &&
		plan.tasks.length === 24 &&
		new Set(plan.tasks.map((task) => task.id)).size === 24 &&
		families.every((family) => plan.tasks.filter((task) => task.family === family).length === 2) &&
		settings.variants.every((variant) => records.filter((record) => record.variant === variant).length === 48) &&
		plan.tasks.every((task) =>
			settings.variants.every((variant) =>
				settings.seeds.every(
					(seed) =>
						records.filter(
							(record) =>
								record.taskId === task.id &&
								record.variant === variant &&
								record.seed === seed &&
								record.run === 0,
						).length === 1,
				),
			),
		);
	const validPasses = records.every((record) => typeof record.pass === "boolean");
	const validElapsed = records.every((record) => Number.isFinite(record.elapsedMs) && record.elapsedMs >= 0);
	const outcomeComplete = complete && validPasses;
	const elapsedComplete = complete && validElapsed;
	const usageComplete =
		complete && records.every((record) => record.usageComplete === true && validUsage(record.usage));
	const comparisons = [
		["helpers", "minimal"],
		["helpers", "current"],
		["helpers", "docs"],
		["minimal", "current"],
	].map(([left, right]) => {
		const byFamily = families.map((family) => {
			const selected = (variant) =>
				records.filter((record) => record.variant === variant && familyByTask[record.taskId] === family);
			const l = selected(left);
			const r = selected(right);
			return {
				family,
				leftAttempts: l.length,
				rightAttempts: r.length,
				successDifference: difference(l, r, (record) => Number(record.pass)),
				elapsedLogRatio: logRatio(l, r, (record) => record.elapsedMs),
				uncachedLogRatio: usageComplete ? logRatio(l, r, uncached) : null,
				totalLogRatio: usageComplete ? logRatio(l, r, total) : null,
				leftSuccesses: l.filter((record) => record.pass).length,
				rightSuccesses: r.filter((record) => record.pass).length,
			};
		});
		const pairs = matchedPairs(records, plan.tasks, left, right);
		const taskContrasts = plan.tasks.map((task) => {
			const taskPairs = pairs.filter((pair) => pair.taskId === task.id);
			const completeTaskPairs = taskPairs.filter((pair) => pair.left && pair.right);
			return {
				taskId: task.id,
				family: task.family,
				pairs: completeTaskPairs.length,
				difference:
					completeTaskPairs.length === settings.seeds.length
						? average(completeTaskPairs.map((pair) => pair.successDifference))
						: null,
			};
		});
		const pairedFamilies = families.map((family) =>
			taskContrasts.filter((contrast) => contrast.family === family).map((contrast) => contrast.difference),
		);
		return {
			left,
			right,
			byFamily,
			pairAccounting: {
				expectedPairs: plan.tasks.length * settings.seeds.length,
				pairedSlots: pairs.length,
				completePairs: pairs.filter((pair) => pair.left && pair.right).length,
				discordantPairs: pairs.filter((pair) => pair.discordant).length,
				missingOrDuplicatePairs: pairs.filter((pair) => !pair.left || !pair.right).length,
			},
			taskContrasts,
			success: outcomeComplete ? signFlipInterval(pairedFamilies.map(average)) : null,
			elapsed: elapsedComplete ? relativeInterval(byFamily.map((row) => row.elapsedLogRatio)) : null,
			uncached: usageComplete ? relativeInterval(byFamily.map((row) => row.uncachedLogRatio)) : null,
			total: usageComplete ? relativeInterval(byFamily.map((row) => row.totalLogRatio)) : null,
		};
	});
	const primary = comparisons[0];
	const decisions = {
		success: classify(primary.success?.interval, -0.05, "lower"),
		uncached: classify(primary.uncached?.interval, -0.15, "upper"),
		elapsed: classify(primary.elapsed?.interval, 0.1, "upper"),
	};
	const checks = {
		completePlan: complete,
		validBooleanPasses: validPasses,
		validElapsed,
		completeUsage: usageComplete,
		successWithinFivePoints: (primary.success?.interval?.[0] ?? Number.NEGATIVE_INFINITY) >= -0.05,
		uncachedSavingAtLeast15Percent: (primary.uncached?.interval?.[1] ?? Number.POSITIVE_INFINITY) <= -0.15,
		elapsedRegressionAtMost10Percent: (primary.elapsed?.interval?.[1] ?? Number.POSITIVE_INFINITY) <= 0.1,
	};
	const operations = ["docs", "current", "minimal", "helpers"].map((variant) => {
		const selected = records.filter((record) => record.variant === variant);
		const successes = selected.filter((record) => record.pass).length;
		const elapsedMs = selected.reduce((sum, record) => sum + record.elapsedMs, 0);
		const observedTotal = selected.reduce((sum, record) => sum + (validUsage(record.usage) ? total(record) : 0), 0);
		const observedUncached = selected.reduce(
			(sum, record) => sum + (validUsage(record.usage) ? uncached(record) : 0),
			0,
		);
		return {
			variant,
			attempts: selected.length,
			successes,
			elapsedMs,
			observedTotal,
			observedUncached,
			elapsedPerSuccessMs: successes ? elapsedMs / successes : "Infinity",
			observedTotalPerSuccess: successes ? observedTotal / successes : "Infinity",
			observedUncachedPerSuccess: successes ? observedUncached / successes : "Infinity",
			usageComplete: selected.every((record) => record.usageComplete === true && validUsage(record.usage)),
		};
	});
	return {
		identity,
		complete,
		validity: { booleanPasses: validPasses, elapsed: validElapsed },
		usageComplete,
		comparisons,
		operations,
		gate: {
			checks,
			decisions,
			supportedNumerically: Object.values(checks).every(Boolean),
			disposition: Object.values(checks).every(Boolean)
				? "Requires independent artifact-review clearance"
				: "No replacement supported; inspect intervals to distinguish negative evidence from inconclusive evidence.",
		},
		zeroDiscordanceCaution:
			outcomeComplete &&
			primary.pairAccounting.completePairs === primary.pairAccounting.expectedPairs &&
			primary.pairAccounting.discordantPairs === 0
				? {
						observedPairs: primary.pairAccounting.completePairs,
						familyAnyDiscordanceUpper95: 1 - 0.05 ** (1 / 12),
						note: "The exact bound is for the family-level chance of any discordance and uses twelve families as independent units. Constant family contrasts never establish equivalence.",
					}
				: null,
	};
}

function matchedPairs(records, tasks, leftVariant, rightVariant) {
	return tasks.flatMap((task) =>
		settings.seeds.map((seed) => {
			const select = (variant) =>
				records.filter(
					(record) =>
						record.taskId === task.id &&
						record.seed === seed &&
						record.run === 0 &&
						record.variant === variant,
				);
			const left = select(leftVariant);
			const right = select(rightVariant);
			return {
				taskId: task.id,
				family: task.family,
				seed,
				left: left.length === 1 ? left[0] : null,
				right: right.length === 1 ? right[0] : null,
				successDifference:
					left.length === 1 && right.length === 1 ? Number(left[0].pass) - Number(right[0].pass) : null,
				discordant: left.length === 1 && right.length === 1 && left[0].pass !== right[0].pass,
			};
		}),
	);
}

function classify(interval, target, direction) {
	if (!interval) {
		return "inconclusive";
	}
	if (direction === "lower") {
		return interval[0] >= target ? "supported" : interval[1] < target ? "fails target" : "inconclusive";
	}
	return interval[1] <= target ? "supported" : interval[0] > target ? "fails target" : "inconclusive";
}

function validUsage(usage) {
	return (
		usage &&
		[usage.inputTokens, usage.cachedInputTokens, usage.outputTokens].every(
			(value) => Number.isFinite(value) && value >= 0,
		) &&
		usage.cachedInputTokens <= usage.inputTokens
	);
}
function total(record) {
	return record.usage.inputTokens + record.usage.outputTokens;
}
function uncached(record) {
	return total(record) - record.usage.cachedInputTokens;
}
function difference(left, right, metric) {
	return left.length && right.length ? average(left.map(metric)) - average(right.map(metric)) : null;
}
function logRatio(left, right, metric) {
	const l = average(left.map(metric));
	const r = average(right.map(metric));
	return l > 0 && r > 0 ? Math.log(l / r) : null;
}

async function main(input) {
	assert.ok(input, "Supply the evidence directory.");
	const directory = path.resolve(input);
	const plan = JSON.parse(await readFile(path.join(directory, "plan.json"), "utf8"));
	const terminalReport = JSON.parse(await readFile(path.join(directory, "report.json"), "utf8"));
	plan.metadata = terminalReport.metadata;
	const raw = (await readFile(path.join(directory, "records.jsonl"), "utf8")).trim();
	const records = raw ? raw.split("\n").map(JSON.parse) : [];
	const conditions = JSON.parse(await readFile(path.join(directory, "conditions.json"), "utf8"));
	const report = analyze(records, plan);
	report.reuse = [];
	for (const record of records.filter((record) => record.variant === "helpers")) {
		const attempt = path.join(
			directory,
			"attempts",
			`${record.seed}-${record.run}-${record.taskId}-${record.variant}`,
		);
		const trace = JSON.parse(await readFile(path.join(attempt, "trace.json"), "utf8"));
		const source = await readFile(path.join(attempt, "solution.ts"), "utf8");
		const evidence = reuseEvidence(record, trace.tools, source, conditions.helpers);
		evidence.helperReads = [
			...new Set(
				trace.tools
					.filter(
						(entry) =>
							entry.name === "read_file" &&
							!entry.result.error &&
							Object.hasOwn(conditions.helpers.scaffolds, entry.args.path),
					)
					.map((entry) => entry.args.path),
			),
		];
		report.reuse.push(evidence);
	}
	await writeFile(path.join(directory, "analysis.json"), JSON.stringify(report, null, 2));
	const markdown = `# Optional helper analysis\n\nAll attempts remain in denominators. Primary comparison: helpers versus identical minimal instructions. Family-specific comparisons are descriptive.\n\n\`\`\`json\n${JSON.stringify({ complete: report.complete, usageComplete: report.usageComplete, gate: report.gate, operations: report.operations, primary: report.comparisons[0] }, null, 2)}\n\`\`\`\n`;
	await writeFile(path.join(directory, "analysis.md"), markdown);
	process.stdout.write(`${JSON.stringify(report.gate, null, 2)}\n`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
	main(process.argv[2]).catch((error) => {
		process.stderr.write(`${error.stack}\n`);
		process.exitCode = 1;
	});
}
