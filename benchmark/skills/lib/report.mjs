export function createReport(records, metadata) {
	const groups = groupBy(records, (record) => `${record.variant}\0${record.kind}`);
	const summaries = [];

	for (const [key, group] of groups) {
		const [variant, kind] = key.split("\0");
		const scores = group.map((record) => record.grade.score);
		const passes = group.filter((record) => record.grade.pass).length;
		const taskPassRates = [...groupBy(group, (record) => record.taskId).values()].map(
			(taskRecords) => taskRecords.filter((record) => record.grade.pass).length / taskRecords.length,
		);
		const passRateEstimate = estimate(taskPassRates);

		summaries.push({
			cachedInputTokens: sum(group, "cachedInputTokens"),
			cacheWriteTokens: sum(group, "cacheWriteTokens"),
			contextCharacters: sum(group, "contextCharacters"),
			count: group.length,
			inputTokens: sum(group, "inputTokens"),
			kind,
			latencyMilliseconds: sum(group, "latencyMilliseconds"),
			meanScore: mean(scores),
			outputTokens: sum(group, "outputTokens"),
			passRate: passes / group.length,
			passRate95:
				passRateEstimate.interval === undefined
					? undefined
					: passRateEstimate.interval.map((value) => Math.max(0, Math.min(1, value))),
			reasoningTokens: sum(group, "reasoningTokens"),
			requests: sum(group, "requests"),
			taskCount: taskPassRates.length,
			variant,
		});
	}

	const comparisons = comparePaired(records, "skill", "baseline");

	return { comparisons, metadata, records, summaries };
}

export function renderMarkdown(report) {
	const lines = [
		"# Package Skill evaluation",
		"",
		`- Provider: ${report.metadata.provider}`,
		`- Model: ${report.metadata.model ?? "fixture"}`,
		`- Repetitions: ${report.metadata.runs}`,
		`- Compilation: ${report.metadata.compile ? "enabled" : "disabled"}`,
		"",
		"## Results",
		"",
		"Pass-rate intervals and paired intervals treat tasks as independent clusters and average repetitions within each task.",
		"",
		"| Variant | Kind | Jobs / tasks | Pass rate (95% CI) | Mean score | Input tokens | Cached / writes | Output tokens | Reasoning tokens | Context chars | Latency |",
		"| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |",
	];

	for (const summary of report.summaries) {
		lines.push(
			`| ${summary.variant} | ${summary.kind} | ${summary.count} / ${summary.taskCount} | ${percent(summary.passRate)} ${formatInterval(summary.passRate95, percent)} | ${summary.meanScore.toFixed(3)} | ${summary.inputTokens} | ${summary.cachedInputTokens} / ${summary.cacheWriteTokens} | ${summary.outputTokens} | ${summary.reasoningTokens} | ${summary.contextCharacters} | ${(summary.latencyMilliseconds / 1_000).toFixed(1)}s |`,
		);
	}

	lines.push(
		"",
		"## Paired Skill minus baseline differences",
		"",
		"A positive score or pass-rate difference favors Skills. A negative token or latency difference favors Skills.",
		"Intervals are Student-t 95% confidence intervals over task-level paired means and are omitted below five tasks.",
		"Total tokens include cached input. Uncached tokens subtract cached input before adding output tokens.",
		"",
		"| Kind | Tasks | Score difference | Pass-rate difference | Total-token difference | Uncached-token difference | Latency difference |",
		"| --- | ---: | ---: | ---: | ---: | ---: | ---: |",
	);

	for (const comparison of report.comparisons) {
		lines.push(
			`| ${comparison.kind} | ${comparison.count} | ${formatEstimate(comparison.score)} | ${formatEstimate(comparison.passRate, percent)} | ${formatEstimate(comparison.tokens)} | ${formatEstimate(comparison.uncachedTokens)} | ${formatEstimate(comparison.latencyMilliseconds, (value) => `${value.toFixed(0)}ms`)} |`,
		);
	}

	const failures = report.records.filter((record) => !record.grade.pass);

	if (failures.length > 0) {
		lines.push("", "## Failures", "");

		for (const record of failures) {
			lines.push(
				`- ${record.taskId} (${record.variant}, run ${record.run}): ${record.error ?? JSON.stringify(record.grade.checks)}`,
			);
		}
	}

	return `${lines.join("\n")}\n`;
}

function comparePaired(records, leftVariant, rightVariant) {
	const pairs = new Map();

	for (const record of records) {
		const key = `${record.kind}\0${record.taskId}\0${record.run}`;
		const pair = pairs.get(key) ?? {};
		pair[record.variant] = record;
		pairs.set(key, pair);
	}

	const byTask = new Map();

	for (const pair of pairs.values()) {
		const left = pair[leftVariant];
		const right = pair[rightVariant];

		if (left === undefined || right === undefined) {
			continue;
		}

		const key = `${left.kind}\0${left.taskId}`;
		const differences = byTask.get(key) ?? {
			kind: left.kind,
			latencyMilliseconds: [],
			passRate: [],
			score: [],
			tokens: [],
			uncachedTokens: [],
		};
		differences.score.push(left.grade.score - right.grade.score);
		differences.passRate.push(Number(left.grade.pass) - Number(right.grade.pass));
		differences.tokens.push(
			left.metrics.inputTokens +
				left.metrics.outputTokens -
				right.metrics.inputTokens -
				right.metrics.outputTokens,
		);
		differences.uncachedTokens.push(
			left.metrics.inputTokens -
				left.metrics.cachedInputTokens +
				left.metrics.outputTokens -
				right.metrics.inputTokens +
				right.metrics.cachedInputTokens -
				right.metrics.outputTokens,
		);
		differences.latencyMilliseconds.push(left.metrics.latencyMilliseconds - right.metrics.latencyMilliseconds);
		byTask.set(key, differences);
	}

	const byKind = new Map();

	for (const differences of byTask.values()) {
		const taskMeans = byKind.get(differences.kind) ?? {
			latencyMilliseconds: [],
			passRate: [],
			score: [],
			tokens: [],
			uncachedTokens: [],
		};

		for (const field of Object.keys(taskMeans)) {
			taskMeans[field].push(mean(differences[field]));
		}
		byKind.set(differences.kind, taskMeans);
	}

	return [...byKind.entries()].map(([kind, taskMeans]) => ({
		count: taskMeans.score.length,
		kind,
		latencyMilliseconds: estimate(taskMeans.latencyMilliseconds),
		passRate: estimate(taskMeans.passRate),
		score: estimate(taskMeans.score),
		tokens: estimate(taskMeans.tokens),
		uncachedTokens: estimate(taskMeans.uncachedTokens),
	}));
}

function estimate(values) {
	const average = mean(values);

	if (values.length < 5) {
		return { interval: undefined, mean: average };
	}

	const variance = values.reduce((total, value) => total + (value - average) ** 2, 0) / (values.length - 1);
	const margin = tCritical95(values.length - 1) * Math.sqrt(variance / values.length);

	return { interval: [average - margin, average + margin], mean: average };
}

function tCritical95(degreesOfFreedom) {
	const values = [
		12.706, 4.303, 3.182, 2.776, 2.571, 2.447, 2.365, 2.306, 2.262, 2.228, 2.201, 2.179, 2.16, 2.145, 2.131, 2.12,
		2.11, 2.101, 2.093, 2.086, 2.08, 2.074, 2.069, 2.064, 2.06, 2.056, 2.052, 2.048, 2.045, 2.042,
	];

	return values[degreesOfFreedom - 1] ?? 1.96;
}

function groupBy(values, keyOf) {
	const groups = new Map();

	for (const value of values) {
		const key = keyOf(value);
		const group = groups.get(key) ?? [];
		group.push(value);
		groups.set(key, group);
	}

	return groups;
}

function sum(records, field) {
	return records.reduce((total, record) => total + record.metrics[field], 0);
}

function mean(values) {
	return values.length === 0 ? 0 : values.reduce((total, value) => total + value, 0) / values.length;
}

function percent(value) {
	return `${(value * 100).toFixed(1)}%`;
}

function formatEstimate(estimateValue, formatter = (value) => value.toFixed(3)) {
	const formatted = formatter(estimateValue.mean);

	if (estimateValue.interval === undefined) {
		return `${formatted} (n<5)`;
	}

	return `${formatted} [${formatter(estimateValue.interval[0])}, ${formatter(estimateValue.interval[1])}]`;
}

function formatInterval(interval, formatter) {
	return interval === undefined ? "(n<5 tasks)" : `(${formatter(interval[0])}–${formatter(interval[1])})`;
}
