import assert from "node:assert/strict";
import test from "node:test";
import { renderReport, summarize } from "../report.mjs";

function record(overrides = {}) {
	return {
		taskId: "task",
		variant: "docs",
		seed: 1,
		run: 0,
		pass: true,
		usage: { inputTokens: 100, cachedInputTokens: 40, outputTokens: 20 },
		elapsedMs: 2000,
		actions: 3,
		copies: 0,
		checkResults: [],
		...overrides,
	};
}

test("failure costs and elapsed time remain in every denominator", () => {
	const report = summarize([record(), record({ run: 1, pass: false, elapsedMs: 4000 })]);
	const summary = report.conditions[0];
	assert.equal(summary.successRate, 0.5);
	assert.equal(summary.totalTokens, 240);
	assert.equal(summary.uncachedTokens, 160);
	assert.equal(summary.meanElapsedMs, 3000);
	assert.equal(summary.elapsedPerSuccessMs, 6000);
});

test("missing usage is disclosed and cannot create a false token comparison", () => {
	const report = summarize([record(), record({ variant: "minimal", pass: false, usage: null })]);
	assert.equal(report.conditions[1].usageRecords, 0);
	assert.match(renderReport(report), /token sums are incomplete/);
	assert.ok(Number.isNaN(report.comparisons[0].tokens.mean));
});

test("pairing includes seeds and clusters repetitions within distinct tasks", () => {
	const records = [];
	for (let task = 0; task < 5; ++task) {
		for (const seed of [1, 2]) {
			for (let run = 0; run < 3; ++run) {
				records.push(record({ taskId: String(task), seed, run }));
				records.push(record({ taskId: String(task), seed, run, variant: "minimal", elapsedMs: 1500 }));
			}
		}
	}
	const comparison = summarize(records).comparisons[0];
	assert.equal(comparison.count, 5);
	assert.equal(comparison.latencyMilliseconds.mean, -500);
	assert.deepEqual(comparison.latencyMilliseconds.interval, [-500, -500]);
});

test("interrupted usage remains in observed totals but cannot support complete cost claims", () => {
	const report = summarize([record(), record({ variant: "minimal", pass: false, usageComplete: false })]);
	assert.equal(report.conditions[1].totalTokens, 120);
	assert.equal(report.conditions[1].completeUsageRecords, 0);
	assert.match(renderReport(report), /usage missing or incomplete/);
	assert.ok(Number.isNaN(report.comparisons[0].tokens.mean));
});
