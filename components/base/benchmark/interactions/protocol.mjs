export const conditions = ["base", "base-ui"];
export const pairCount = 5;
export const protocolRevision = 1;

export const metrics = [
	{
		field: "durationMs",
		id: "semantic-completion",
		description: "Public operation through final observable DOM state",
	},
	{
		field: "renderOpportunityDurationMs",
		id: "subsequent-render-opportunity",
		description: "Public operation through the first requestAnimationFrame callback after final DOM state",
	},
];

export const practicalThresholds = {
	medianNoRegressionRatio: 1 / 1.05,
	medianRegressionFraction: 0.05,
	p95NoRegressionRatio: 1 / 1.1,
	p95RegressionFraction: 0.1,
};

export const workloads = [
	{ component: "tabs", count: 30, id: "tabs-mount-30", recorded: 30, type: "mount", warmups: 3 },
	{
		component: "tabs",
		count: 30,
		id: "tabs-switch-30",
		recorded: 30,
		repetitions: 1,
		type: "update",
		warmups: 6,
	},
	{ component: "tabs", count: 30, id: "tabs-teardown-30", recorded: 30, type: "teardown", warmups: 3 },
	{ component: "dialog", count: 25, id: "dialog-mount-25", recorded: 30, type: "mount", warmups: 3 },
	{
		component: "dialog",
		count: 25,
		id: "dialog-open-close-25",
		recorded: 30,
		repetitions: 1,
		type: "update",
		warmups: 6,
	},
	{
		component: "dialog",
		count: 25,
		id: "dialog-teardown-25",
		recorded: 30,
		type: "teardown",
		warmups: 3,
	},
];
