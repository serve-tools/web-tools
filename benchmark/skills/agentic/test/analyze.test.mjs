import assert from "node:assert/strict";
import test from "node:test";
import { analyze, renderAnalysis } from "../analyze.mjs";

function record(overrides = {}) {
	return {
		variant: "docs",
		seed: 1,
		run: 0,
		taskId: "task-a",
		status: "completed",
		pass: true,
		elapsedMs: 1_000,
		usage: { inputTokens: 100, cachedInputTokens: 40, outputTokens: 20 },
		usageComplete: true,
		actions: 1,
		checkResults: [],
		grade: { compile: true, contracts: true, smoke: true, hidden: true },
		...overrides,
	};
}

test("keeps failed elapsed cost and emits task-clustered paired deltas", () => {
	const records = [];
	for (const taskId of ["task-a", "task-b"]) {
		for (const seed of [1, 2]) {
			for (const run of [0, 1]) {
				records.push(record({ taskId, seed, run, pass: run === 0, elapsedMs: 2_000 }));
				records.push(record({ variant: "minimal", taskId, seed, run, copies: 1, elapsedMs: 1_000 }));
			}
		}
	}
	const analysis = analyze(records, {
		plan: { metadata: { plannedAttempts: records.length, seeds: [1, 2], variants: ["docs", "minimal"] } },
	});
	const docs = analysis.conditionSeeds.find((entry) => entry.variant === "docs" && entry.seed === 1);
	const minimal = analysis.conditionSeeds.find((entry) => entry.variant === "minimal" && entry.seed === 1);
	const comparison = analysis.paired.find((entry) => entry.left === "minimal" && entry.right === "docs");

	assert.equal(docs.success.count, 2);
	assert.equal(docs.cost.meanElapsedMs, 2_000);
	assert.deepEqual(minimal.copies, { attempts: 4, count: 4 });
	assert.equal(comparison.bySeed[0].elapsedDifference.mean, -1_000);
	assert.equal(comparison.relative.elapsedMs.mean, -0.5);
	assert.equal(comparison.relative.elapsedMs.clusters, 2);
});

test("marks token inference unavailable when a paired usage record is incomplete while retaining its lower bound", () => {
	const records = [
		record({ variant: "docs", usageComplete: false, pass: false, status: "timedOut", elapsedMs: 4_000 }),
		record({ variant: "current", elapsedMs: 2_000 }),
	];
	const analysis = analyze(records, {
		plan: { metadata: { plannedAttempts: 2, seeds: [1], variants: ["docs", "current"] } },
	});
	const comparison = analysis.paired.find((entry) => entry.left === "current" && entry.right === "docs");
	const docs = analysis.conditionSeeds.find((entry) => entry.variant === "docs");

	assert.equal(docs.usage.incomplete, 1);
	assert.equal(docs.usage.observedTotalTokens, 120);
	assert.equal(comparison.pairCompleteness.incompleteUsagePairs, 1);
	assert.ok(Number.isNaN(comparison.relative.totalTokens.mean));
	assert.match(renderAnalysis(analysis), /unavailable/);
});

test("reports final failure stages without treating an artifact pass after timeout as success", () => {
	const records = [
		record({
			pass: false,
			status: "timedOut",
			grade: { compile: true, contracts: true, smoke: true, hidden: true },
		}),
		record({
			taskId: "task-b",
			pass: false,
			grade: { compile: true, contracts: true, smoke: true, hidden: false },
		}),
	];
	const analysis = analyze(records, { plan: { metadata: { plannedAttempts: 2, seeds: [1], variants: ["docs"] } } });

	assert.deepEqual(analysis.conditionSuccess[0].failureStages, {
		incomplete: 1,
		artifactPassIncomplete: 1,
		hidden: 1,
	});
});

test("clips absolute success intervals but keeps paired differences in percentage points", () => {
	const records = [
		record({ taskId: "task-a", pass: true }),
		record({ taskId: "task-b", pass: false }),
		record({ variant: "current", taskId: "task-a", pass: false }),
		record({ variant: "current", taskId: "task-b", pass: true }),
	];
	const analysis = analyze(records, {
		plan: { metadata: { plannedAttempts: 4, seeds: [1], variants: ["docs", "current"] } },
	});
	const markdown = renderAnalysis(analysis);

	assert.deepEqual(analysis.conditionSuccess[0].success.interval, [0, 1]);
	assert.match(markdown, /50\.0% \[0\.0%, 100\.0%\]/);
	assert.match(markdown, /0\.0pp \[-1270\.6pp, 1270\.6pp\]/);
});
