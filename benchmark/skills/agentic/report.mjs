import { createReport } from "../lib/report.mjs";

/** Keep failures in every denominator and pair observations by task, seed, and repetition. */
export function summarize(records, metadata = {}) {
	const variants = [...new Set(records.map((record) => record.variant))];
	const normalized = records.map(normalize);
	const summary = createReport(normalized, metadata);
	const comparisons = [];
	for (const [left, right] of [
		["current", "docs"],
		["minimal", "docs"],
		["minimal", "current"],
	]) {
		const paired = normalized
			.filter((record) => record.variant === left || record.variant === right)
			.map((record) => ({ ...record, variant: record.variant === left ? "skill" : "baseline" }));
		for (const comparison of createReport(paired, metadata).comparisons) {
			comparisons.push({ left, right, ...comparison });
		}
	}
	return {
		metadata,
		conditions: variants.map((variant) => {
			const group = records.filter((record) => record.variant === variant);
			const measured = group.filter((record) => record.usage !== null && record.usage !== undefined);
			const completeUsageRecords = measured.filter((record) => record.usageComplete !== false).length;
			const successes = group.filter((record) => record.pass).length;
			const totalTokens = measured.reduce(
				(sum, record) => sum + record.usage.inputTokens + record.usage.outputTokens,
				0,
			);
			const uncachedTokens = measured.reduce(
				(sum, record) =>
					sum + record.usage.inputTokens - record.usage.cachedInputTokens + record.usage.outputTokens,
				0,
			);
			const elapsedMs = group.reduce((sum, record) => sum + record.elapsedMs, 0);
			return {
				variant,
				attempts: group.length,
				successes,
				successRate: successes / group.length,
				firstCheckPasses: group.filter(
					(record) => record.checkResults?.[0]?.compile && record.checkResults[0].smoke,
				).length,
				usageRecords: measured.length,
				completeUsageRecords,
				totalTokens,
				uncachedTokens,
				elapsedMs,
				meanElapsedMs: elapsedMs / group.length,
				p50ElapsedMs: quantile(
					group.map((record) => record.elapsedMs),
					0.5,
				),
				p95ElapsedMs: quantile(
					group.map((record) => record.elapsedMs),
					0.95,
				),
				meanActions: group.reduce((sum, record) => sum + record.actions, 0) / group.length,
				meanChecks: group.reduce((sum, record) => sum + record.checkResults.length, 0) / group.length,
				copyAttempts: group.filter((record) => record.copies > 0).length,
				elapsedPerSuccessMs: successes ? elapsedMs / successes : null,
				uncachedPerSuccess: successes ? uncachedTokens / successes : null,
				successRate95: summary.summaries.find((entry) => entry.variant === variant)?.passRate95,
			};
		}),
		comparisons,
		tasks: [...new Set(records.map((record) => record.taskId))].map((taskId) => ({
			taskId,
			variants: Object.fromEntries(
				variants.map((variant) => {
					const group = records.filter((record) => record.taskId === taskId && record.variant === variant);
					return [
						variant,
						{
							attempts: group.length,
							successes: group.filter((record) => record.pass).length,
							meanElapsedMs: group.reduce((sum, record) => sum + record.elapsedMs, 0) / group.length,
						},
					];
				}),
			),
		})),
	};
}

export function renderReport(report) {
	const lines = [
		"# Agentic skill evaluation",
		"",
		"All attempts, including failures and timeouts, remain in success and elapsed-time denominators.",
		"Token totals include cached input and output; uncached totals subtract cached input. Reasoning is already included in output.",
		"Intervals cluster repetitions within tasks; they describe this task corpus, not all possible work.",
		"",
		"| Condition | Success | Total tokens | Uncached tokens | Mean elapsed | p50 / p95 | Mean actions / checks | Copy attempts |",
		"| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |",
	];
	for (const row of report.conditions) {
		lines.push(
			`| ${row.variant} | ${row.successes}/${row.attempts} (${(100 * row.successRate).toFixed(1)}%) | ${row.totalTokens.toLocaleString("en-US")} | ${row.uncachedTokens.toLocaleString("en-US")} | ${seconds(row.meanElapsedMs)} | ${seconds(row.p50ElapsedMs)} / ${seconds(row.p95ElapsedMs)} | ${row.meanActions.toFixed(1)} / ${row.meanChecks.toFixed(1)} | ${row.copyAttempts} |`,
		);
		if (row.completeUsageRecords < row.attempts) {
			lines.push(
				`\n**${row.variant}: usage missing or incomplete for ${row.attempts - row.completeUsageRecords} attempts; token sums are incomplete, not zero-cost failures.**\n`,
			);
		}
	}
	lines.push(
		"",
		"## Task results",
		"",
		"| Task | Ordinary docs | Current skills | Minimal + recipes |",
		"| --- | ---: | ---: | ---: |",
	);
	for (const task of report.tasks) {
		lines.push(
			`| ${task.taskId} | ${["docs", "current", "minimal"]
				.map((variant) => {
					const row = task.variants[variant];
					return row ? `${row.successes}/${row.attempts}, ${seconds(row.meanElapsedMs)}` : "—";
				})
				.join(" | ")} |`,
		);
	}
	lines.push(
		"",
		"## Paired differences",
		"",
		"Positive success differences favor the first condition; negative token/time differences favor it.",
		"The intervals are unadjusted, exploratory 95% Student-t intervals across task-level means; inspect each seed and failure mode before adoption.",
		"",
		"| Comparison | Tasks | Success difference | Total-token difference | Uncached-token difference | Elapsed difference |",
		"| --- | ---: | ---: | ---: | ---: | ---: |",
	);
	for (const row of report.comparisons) {
		lines.push(
			`| ${row.left} − ${row.right} | ${row.count} | ${estimate(row.passRate, (value) => `${(value * 100).toFixed(1)}pp`)} | ${estimate(row.tokens)} | ${estimate(row.uncachedTokens)} | ${estimate(row.latencyMilliseconds, seconds)} |`,
		);
	}
	lines.push("", "## Experiment metadata", "", "```json", JSON.stringify(report.metadata, null, 2), "```", "");
	return lines.join("\n");
}

function normalize(record) {
	const usage = record.usageComplete === false ? null : record.usage;
	return {
		variant: record.variant,
		kind: "artifact",
		taskId: record.taskId,
		run: `${record.seed}:${record.run}`,
		grade: { pass: record.pass, score: Number(record.pass) },
		metrics: {
			inputTokens: usage?.inputTokens ?? Number.NaN,
			cachedInputTokens: usage?.cachedInputTokens ?? Number.NaN,
			outputTokens: usage?.outputTokens ?? Number.NaN,
			reasoningTokens: usage?.reasoningOutputTokens ?? Number.NaN,
			cacheWriteTokens: usage?.cacheWriteInputTokens ?? 0,
			latencyMilliseconds: record.elapsedMs,
			contextCharacters: 0,
			requests: record.modelRequests ?? 0,
		},
	};
}

function estimate(value, format = (number) => number.toFixed(0)) {
	if (!value || !Number.isFinite(value.mean)) {
		return "unavailable";
	}
	return `${format(value.mean)}${value.interval ? ` [${value.interval.map(format).join(", ")}]` : " (insufficient tasks)"}`;
}

function seconds(value) {
	return `${(value / 1_000).toFixed(1)}s`;
}

function quantile(values, quantileValue) {
	const ordered = [...values].sort((left, right) => left - right);
	return ordered[Math.max(0, Math.ceil(ordered.length * quantileValue) - 1)] ?? 0;
}
