import { summarize as originalSummary } from "../report.mjs";

/** Cheap progress reporting; inference is run separately after measurement. */
export function summarize(records, metadata = {}) {
	return {
		...originalSummary(records, metadata),
		comparisons: [],
		inference: "Run ablation/analyze.mjs after the complete measurement.",
	};
}

export function renderReport(report) {
	const lines = [
		"# Optional helper ablation",
		"",
		"Every failure remains in success, elapsed time, and observed token totals. Incomplete usage is a lower bound.",
		"",
		"| Condition | Correct / attempts | Total tokens | Uncached tokens | Mean elapsed | Copies | Usage complete |",
		"| --- | ---: | ---: | ---: | ---: | ---: | ---: |",
	];
	for (const variant of ["docs", "current", "minimal", "helpers"]) {
		const row = report.conditions.find((row) => row.variant === variant);
		if (!row) {
			continue;
		}
		const prefix = row.completeUsageRecords === row.attempts ? "" : "≥";
		lines.push(
			`| ${variant} | ${row.successes}/${row.attempts} | ${prefix}${row.totalTokens} | ${prefix}${row.uncachedTokens} | ${(row.meanElapsedMs / 1000).toFixed(1)}s | ${row.copyAttempts} | ${row.completeUsageRecords}/${row.attempts} |`,
		);
	}
	lines.push(
		"",
		"## Tasks",
		"",
		"| Task | Docs | Current | Minimal | Helpers |",
		"| --- | ---: | ---: | ---: | ---: |",
	);
	for (const task of report.tasks) {
		lines.push(
			`| ${task.taskId} | ${["docs", "current", "minimal", "helpers"]
				.map((variant) => {
					const row = task.variants[variant];
					return row ? `${row.successes}/${row.attempts}` : "—";
				})
				.join(" | ")} |`,
		);
	}
	lines.push(
		"",
		`Completed plan: ${report.metadata.completedPlan ?? false}. Stop reason: ${report.metadata.stopReason ?? "none"}.`,
		"",
	);
	return lines.join("\n");
}
