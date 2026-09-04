export const settings = Object.freeze({
	model: "gpt-5.6-luna",
	effort: "low",
	suite: "ablation",
	runs: 1,
	seeds: [13007, 17011],
	concurrency: 6,
	timeoutMs: 240_000,
	maxActions: 32,
	maxChecks: 4,
	variants: ["docs", "current", "minimal", "helpers"],
	taskIds: [],
});
