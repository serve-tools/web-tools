import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { analyze, renderAnalysis } from "../analyze.mjs";
import { reuseEvidence } from "./reuse.mjs";

export { reuseEvidence } from "./reuse.mjs";

/** Apply the predeclared primary gate; artifact-review clearance remains an explicit extra gate. */
export function evaluateGate(report, analysis, identityAudit) {
	const difference = report.comparisons.find(
		(comparison) => comparison.left === "minimal" && comparison.right === "current",
	);
	const paired = analysis.paired.find(
		(comparison) => comparison.left === "minimal" && comparison.right === "current",
	);
	const complete =
		report.metadata.completedPlan === true &&
		report.metadata.stopReason === null &&
		report.metadata.plannedAttempts === 240 &&
		report.conditions.length === 3 &&
		new Set(report.conditions.map((condition) => condition.variant)).size === 3 &&
		report.conditions.every(
			(condition) =>
				["docs", "current", "minimal"].includes(condition.variant) &&
				condition.attempts === 80 &&
				condition.completeUsageRecords === 80,
		);
	const finite = (value) => Number.isFinite(value);
	const lowerSuccess = difference?.passRate?.interval?.[0];
	const upperUncached = paired?.relative.uncachedTokens.interval?.[1];
	const upperElapsed = paired?.relative.elapsedMs.interval?.[1];
	const checks = {
		allPlannedAttemptsAndUsageComplete: complete,
		exactPlannedIdentities:
			identityAudit?.exact === true &&
			identityAudit.plannedRecords === 240 &&
			identityAudit.observedRecords === 240 &&
			identityAudit.uniquePlannedIdentities === 240 &&
			identityAudit.uniqueObservedIdentities === 240,
		completePrimaryPairs:
			paired?.pairCompleteness?.attemptedPairs === 80 &&
			paired.pairCompleteness.completePairs === 80 &&
			paired.pairCompleteness.incompleteUsagePairs === 0 &&
			paired.pairCompleteness.missingUsagePairs === 0,
		eightPrimaryTaskClusters:
			difference?.count === 8 &&
			paired?.relative.uncachedTokens?.clusters === 8 &&
			paired.relative.elapsedMs?.clusters === 8,
		successNoninferiority: finite(lowerSuccess) && lowerSuccess >= -0.05,
		uncachedSavings: finite(upperUncached) && upperUncached <= -0.15,
		elapsedNoMaterialRegression: finite(upperElapsed) && upperElapsed <= 0.1,
		sameFavorableSeedDirections:
			paired?.bySeed.length === 2 &&
			paired.bySeed.every(
				(seed) =>
					finite(seed.successDifference.mean) &&
					seed.successDifference.mean >= 0 &&
					finite(seed.uncachedTokenDifference.mean) &&
					seed.uncachedTokenDifference.mean < 0,
			),
	};
	return {
		checks,
		numericGatePassed: Object.values(checks).every(Boolean),
		lowerSuccessDifference: lowerSuccess,
		upperUncachedRelativeChange: upperUncached,
		upperElapsedRelativeChange: upperElapsed,
		independentArtifactReview:
			"Required separately; passing numeric gates alone never authorizes an adoption claim.",
	};
}

/** Verify that every measured observation corresponds once to the saved planned allocation. */
export function auditPlannedIdentities(records, jobs) {
	const planned = countIdentities(jobs);
	const observed = countIdentities(records);
	const missing = [...planned.keys()].filter((identity) => !observed.has(identity));
	const unexpected = [...observed.keys()].filter((identity) => !planned.has(identity));
	const duplicatePlanned = [...planned.entries()].filter(([, count]) => count !== 1).map(([identity]) => identity);
	const duplicateObserved = [...observed.entries()].filter(([, count]) => count !== 1).map(([identity]) => identity);

	return {
		plannedRecords: jobs.length,
		observedRecords: records.length,
		uniquePlannedIdentities: planned.size,
		uniqueObservedIdentities: observed.size,
		missing,
		unexpected,
		duplicatePlanned,
		duplicateObserved,
		exact:
			records.length === jobs.length &&
			missing.length === 0 &&
			unexpected.length === 0 &&
			duplicatePlanned.length === 0 &&
			duplicateObserved.length === 0,
	};
}

function countIdentities(entries) {
	const counts = new Map();
	for (const entry of entries) {
		const identity = JSON.stringify([entry.taskId, entry.seed, entry.run, entry.variant]);
		counts.set(identity, (counts.get(identity) ?? 0) + 1);
	}
	return counts;
}

async function main(input) {
	if (!input) {
		throw new Error("Usage: node transfer/analyze.mjs --input DIR");
	}
	const directory = path.resolve(input);
	const [recordsSource, planSource, reportSource, conditionsSource] = await Promise.all(
		["records.jsonl", "plan.json", "report.json", "conditions.json"].map((name) =>
			readFile(path.join(directory, name), "utf8"),
		),
	);
	const records = recordsSource.trim() ? recordsSource.trim().split("\n").map(JSON.parse) : [];
	const plan = JSON.parse(planSource);
	const report = JSON.parse(reportSource);
	const conditions = JSON.parse(conditionsSource);
	const analysis = analyze(records, { plan, report });
	const identityAudit = auditPlannedIdentities(records, plan.jobs);
	const reuse = [];
	for (const record of records) {
		const attempt = path.join(
			directory,
			"attempts",
			`${record.seed}-${record.run}-${record.taskId}-${record.variant}`,
		);
		const [source, trace] = await Promise.all([
			readFile(path.join(attempt, "solution.ts"), "utf8"),
			readFile(path.join(attempt, "trace.json"), "utf8"),
		]);
		reuse.push(reuseEvidence(record, JSON.parse(trace).tools, source, conditions[record.variant]));
	}
	const gate = evaluateGate(report, analysis, identityAudit);
	const candidate = reuse.filter((entry) => entry.variant === "minimal");
	const reused = candidate.filter((entry) => entry.copiedRecipe);
	const retention = reused.map((entry) => entry.bestRetainedFraction).sort((left, right) => left - right);
	const mechanism = {
		attempts: candidate.length,
		copied: reused.length,
		medianRetainedFraction: retention.length ? retention[Math.floor(retention.length / 2)] : null,
		atLeastHalfRecipeLinesRetained: reused.filter((entry) => entry.bestRetainedFraction >= 0.5).length,
		workflowErrors: candidate.reduce((sum, entry) => sum + entry.workflowErrors, 0),
		definition:
			"Line retention uses distinct trimmed lines of at least 12 characters, excluding imports and comments. Helper metadata compares parsed declaration structure while ignoring locations, raw literals, and comments, then counts final-program identifier occurrences outside that declaration. Occurrences are not scope-resolved references. Both are descriptive source-shape proxies, not semantic lineage, execution evidence, or quality scores.",
	};
	const timing = summarizeTiming(records, plan.metadata?.variants, plan.metadata?.seeds);
	await writeFile(
		path.join(directory, "analysis.json"),
		JSON.stringify({ ...analysis, gate, identityAudit, mechanism, timing, reuse }, null, 2),
	);
	const markdown = `${renderAnalysis(analysis)}\n## Predeclared numeric gate\n\n\`\`\`json\n${JSON.stringify(gate, null, 2)}\n\`\`\`\n\n## Planned identity audit\n\n\`\`\`json\n${JSON.stringify(identityAudit, null, 2)}\n\`\`\`\n\n## Copy and retention diagnostics\n\n\`\`\`json\n${JSON.stringify(mechanism, null, 2)}\n\`\`\`\n\n## Descriptive copy and authored-write timing\n\n\`\`\`json\n${JSON.stringify(timing, null, 2)}\n\`\`\`\n`;
	await writeFile(path.join(directory, "analysis.md"), markdown);
	process.stdout.write(markdown);
}

function summarizeTiming(records, variants = [], seeds = []) {
	const selectedVariants = variants.length ? variants : [...new Set(records.map((record) => record.variant))].sort();
	const selectedSeeds = seeds.length ? seeds : [...new Set(records.map((record) => record.seed))].sort();
	return selectedVariants.flatMap((variant) =>
		selectedSeeds.map((seed) => {
			const group = records.filter((record) => record.variant === variant && record.seed === seed);
			return {
				variant,
				seed,
				firstCopyMs: summarizeNullableTiming(group, "firstCopyMs"),
				firstAuthoredWriteMs: summarizeNullableTiming(group, "firstAuthoredWriteMs"),
			};
		}),
	);
}

function summarizeNullableTiming(records, field) {
	const values = records.map((record) => record[field]).filter(Number.isFinite);
	return {
		observedAttempts: values.length,
		meanMs: values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null,
	};
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
	main(process.argv[2] === "--input" ? process.argv[3] : undefined).catch((error) => {
		process.stderr.write(`${error.stack}\n`);
		process.exitCode = 1;
	});
}
