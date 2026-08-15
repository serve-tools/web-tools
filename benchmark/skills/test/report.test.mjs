import assert from "node:assert/strict";
import test from "node:test";
import { createReport, renderMarkdown } from "../lib/report.mjs";

test("report computes paired differences without claiming an interval for tiny samples", () => {
	const records = [record("baseline", 0, 100), record("skill", 1, 80)];
	const report = createReport(records, { compile: false, model: "fixture", provider: "fixture", runs: 1 });
	const markdown = renderMarkdown(report);

	assert.equal(report.comparisons[0].score.mean, 1);
	assert.equal(report.comparisons[0].tokens.mean, -20);
	assert.equal(report.comparisons[0].score.interval, undefined);
	assert.match(markdown, /n<5/);
});

function record(variant, score, tokens) {
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
		run: 1,
		taskId: "task",
		variant,
	};
}
