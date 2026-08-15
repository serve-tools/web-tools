export function createReport(records, metadata) {
	const groups = groupBy(records, (record) => `${record.variant}\0${record.kind}`);
	const summaries = [];

	for (const [key, group] of groups) {
		const [variant, kind] = key.split("\0");
		const scores = group.map((record) => record.grade.score);
		const passes = group.filter((record) => record.grade.pass).length;

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
			passRate95: wilson(passes, group.length),
			reasoningTokens: sum(group, "reasoningTokens"),
			requests: sum(group, "requests"),
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
		"| Variant | Kind | N | Pass rate (95% CI) | Mean score | Input tokens | Cached / writes | Output tokens | Reasoning tokens | Context chars | Latency |",
		"| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |",
	];

	for (const summary of report.summaries) {
		lines.push(
			`| ${summary.variant} | ${summary.kind} | ${summary.count} | ${percent(summary.passRate)} (${percent(summary.passRate95[0])}–${percent(summary.passRate95[1])}) | ${summary.meanScore.toFixed(3)} | ${summary.inputTokens} | ${summary.cachedInputTokens} / ${summary.cacheWriteTokens} | ${summary.outputTokens} | ${summary.reasoningTokens} | ${summary.contextCharacters} | ${(summary.latencyMilliseconds / 1_000).toFixed(1)}s |`,
		);
	}

	lines.push(
		"",
		"## Paired Skill minus baseline differences",
		"",
		"A positive score or pass-rate difference favors Skills. A negative token or latency difference favors Skills.",
		"Intervals are normal-approximation 95% confidence intervals over paired task repetitions and are omitted below five pairs.",
		"",
		"| Kind | Pairs | Score difference | Pass-rate difference | Token difference | Latency difference |",
		"| --- | ---: | ---: | ---: | ---: | ---: |",
	);

	for (const comparison of report.comparisons) {
		lines.push(
			`| ${comparison.kind} | ${comparison.count} | ${formatEstimate(comparison.score)} | ${formatEstimate(comparison.passRate, percent)} | ${formatEstimate(comparison.tokens)} | ${formatEstimate(comparison.latencyMilliseconds, (value) => `${value.toFixed(0)}ms`)} |`,
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

	const byKind = new Map();

	for (const pair of pairs.values()) {
		const left = pair[leftVariant];
		const right = pair[rightVariant];

		if (left === undefined || right === undefined) {
			continue;
		}

		const differences = byKind.get(left.kind) ?? { latencyMilliseconds: [], passRate: [], score: [], tokens: [] };
		differences.score.push(left.grade.score - right.grade.score);
		differences.passRate.push(Number(left.grade.pass) - Number(right.grade.pass));
		differences.tokens.push(
			left.metrics.inputTokens +
				left.metrics.outputTokens -
				right.metrics.inputTokens -
				right.metrics.outputTokens,
		);
		differences.latencyMilliseconds.push(left.metrics.latencyMilliseconds - right.metrics.latencyMilliseconds);
		byKind.set(left.kind, differences);
	}

	return [...byKind.entries()].map(([kind, differences]) => ({
		count: differences.score.length,
		kind,
		latencyMilliseconds: estimate(differences.latencyMilliseconds),
		passRate: estimate(differences.passRate),
		score: estimate(differences.score),
		tokens: estimate(differences.tokens),
	}));
}

function estimate(values) {
	const average = mean(values);

	if (values.length < 5) {
		return { interval: undefined, mean: average };
	}

	const variance = values.reduce((total, value) => total + (value - average) ** 2, 0) / (values.length - 1);
	const margin = 1.96 * Math.sqrt(variance / values.length);

	return { interval: [average - margin, average + margin], mean: average };
}

function wilson(successes, count) {
	if (count === 0) {
		return [0, 0];
	}

	const z = 1.96;
	const proportion = successes / count;
	const denominator = 1 + z ** 2 / count;
	const center = (proportion + z ** 2 / (2 * count)) / denominator;
	const margin = (z * Math.sqrt((proportion * (1 - proportion)) / count + z ** 2 / (4 * count ** 2))) / denominator;

	return [Math.max(0, center - margin), Math.min(1, center + margin)];
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
