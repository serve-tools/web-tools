import assert from "node:assert/strict";
import test from "node:test";
import { createReport, renderMarkdown } from "../lib/report.mjs";

test("report computes paired differences without claiming an interval for tiny samples", () => {
	const records = [record("baseline", 0, 100), record("skill", 1, 80)];
	const report = createReport(records, { compile: false, model: "fixture", provider: "fixture", runs: 1 });
	const markdown = renderMarkdown(report);

	assert.equal(report.comparisons[0].score.mean, 1);
	assert.equal(report.comparisons[0].tokens.mean, -20);
	assert.equal(report.comparisons[0].uncachedTokens.mean, -20);
	assert.equal(report.comparisons[0].score.interval, undefined);
	assert.equal(report.comparisons[0].count, 1);
	assert.equal(report.summaries[0].taskCount, 1);
	assert.match(markdown, /n<5/);
});

test("report clusters repeated runs by task", () => {
	const records = [];

	for (let run = 1; run <= 10; ++run) {
		records.push(record("baseline", 0, 100, "task-a", run), record("skill", 1, 80, "task-a", run));
	}

	const report = createReport(records, { compile: false, model: "fixture", provider: "fixture", runs: 10 });

	assert.equal(report.comparisons[0].count, 1);
	assert.equal(report.comparisons[0].score.mean, 1);
	assert.equal(report.comparisons[0].score.interval, undefined);
	assert.ok(report.summaries.every((summary) => summary.taskCount === 1));
});

function record(variant, score, tokens, taskId = "task", run = 1) {
	return {
		grade: { pass: score === 1, score },
		kind: "selection",
		metrics: {
			cachedInputTokens: 0,
			contextCharacters: 10,
			inputTokens: tokens,
			latencyMilliseconds: tokens,
			outputTokens: 0,
			reasoningTokens: 0,
			requests: 1,
		},
		run,
		taskId,
		variant,
	};
}
