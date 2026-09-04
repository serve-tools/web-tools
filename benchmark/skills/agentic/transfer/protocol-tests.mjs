import assert from "node:assert/strict";
import test from "node:test";
import { createBlockedJobs } from "../run.mjs";
import { createToolSession } from "../tools.mjs";
import { auditPlannedIdentities, evaluateGate } from "./analyze.mjs";
import { reuseEvidence } from "./reuse.mjs";

test("replacement gate rejects uncertain quality or incomplete usage despite attractive means", () => {
	const report = {
		metadata: { completedPlan: true, plannedAttempts: 240, stopReason: null },
		conditions: ["docs", "current", "minimal"].map((variant) => ({
			variant,
			attempts: 80,
			completeUsageRecords: 80,
		})),
		comparisons: [{ left: "minimal", right: "current", count: 8, passRate: { interval: [-0.04, 0.1] } }],
	};
	const analysis = {
		paired: [
			{
				left: "minimal",
				right: "current",
				pairCompleteness: {
					attemptedPairs: 80,
					completePairs: 80,
					incompleteUsagePairs: 0,
					missingUsagePairs: 0,
				},
				relative: {
					uncachedTokens: { interval: [-0.4, -0.16], clusters: 8 },
					elapsedMs: { interval: [-0.2, 0.05], clusters: 8 },
				},
				bySeed: [1, 2].map(() => ({
					successDifference: { mean: 0 },
					uncachedTokenDifference: { mean: -2000 },
				})),
			},
		],
	};
	const jobs = plannedJobs();
	assert.equal(evaluateGate(report, analysis, auditPlannedIdentities(jobs, jobs)).numericGatePassed, true);
	report.comparisons[0].passRate.interval[0] = -0.06;
	assert.equal(evaluateGate(report, analysis, auditPlannedIdentities(jobs, jobs)).numericGatePassed, false);
	report.comparisons[0].passRate.interval[0] = -0.04;
	report.conditions[2].completeUsageRecords = 79;
	assert.equal(evaluateGate(report, analysis, auditPlannedIdentities(jobs, jobs)).numericGatePassed, false);
	assert.equal(evaluateGate(report, analysis, auditPlannedIdentities(jobs.slice(1), jobs)).numericGatePassed, false);
	analysis.paired[0].pairCompleteness = {
		attemptedPairs: 80,
		completePairs: 79,
		incompleteUsagePairs: 0,
		missingUsagePairs: 0,
	};
	assert.equal(evaluateGate(report, analysis, auditPlannedIdentities(jobs, jobs)).numericGatePassed, false);
});

test("source reuse stays descriptive and never rewrites behavioral failure", () => {
	const recipe =
		"export function checked(value: number) {\n\treturn Number.isFinite(value);\n}\nexport const unused = 1;\n";
	const trace = [{ name: "copy_file", args: { path: "recipes/recipe.ts" }, result: { written: "solution.ts" } }];
	const result = reuseEvidence(
		{ variant: "minimal", pass: false },
		trace,
		"// rewritten formatting\nexport function checked(value: number) { return Number.isFinite(value); }\nexport const unused = 0x1;\nexport const adapter = checked(2);\n",
		{
			scaffolds: { "recipes/recipe.ts": recipe },
			recipeManifest: [{ file: "recipe.ts", preservedSymbols: ["checked", "unused"] }],
		},
	);
	assert.equal(result.copiedRecipe, true);
	assert.equal(result.bestRetainedFraction, 0);
	assert.equal(result.pass, false);
	assert.equal(result.details[0].helpers[0].structurallyRetained, true);
	assert.equal(result.details[0].helpers[0].finalExternalIdentifierOccurrencesOutsideDeclaration, 1);
	assert.equal(result.details[0].helpers[1].structurallyRetained, true);
	const bigintRecipe = "export const huge = 1n;\n";
	assert.equal(
		reuseEvidence(
			{ variant: "minimal", pass: false },
			[{ name: "copy_file", args: { path: "recipes/bigint.ts" }, result: { written: "solution.ts" } }],
			bigintRecipe,
			{
				scaffolds: { "recipes/bigint.ts": bigintRecipe },
				recipeManifest: [{ file: "bigint.ts", preservedSymbols: ["huge"] }],
			},
		).details[0].helpers[0].structurallyRetained,
		true,
	);
});

test("blocked allocation preserves every matched treatment and deterministic ordering", () => {
	const tasks = [{ id: "first" }, { id: "second" }, { id: "third" }];
	const options = { seeds: [7349], runs: 4, variants: ["docs", "current", "minimal"] };
	const jobs = createBlockedJobs(tasks, options);
	assert.equal(jobs.length, 36);
	assert.deepEqual(jobs, createBlockedJobs(tasks, options));
	assert.equal(new Set(jobs.map((job) => JSON.stringify(job))).size, jobs.length);
	for (let index = 0; index < jobs.length; index += 3) {
		const block = jobs.slice(index, index + 3);
		assert.equal(new Set(block.map(({ taskId, seed, run }) => `${taskId}:${seed}:${run}`)).size, 1);
		assert.deepEqual(block.map((job) => job.variant).sort(), ["current", "docs", "minimal"]);
	}
	const orders = new Map();
	for (let index = 0; index < jobs.length; index += 3) {
		const order = jobs
			.slice(index, index + 3)
			.map((job) => job.variant)
			.join(",");
		orders.set(order, (orders.get(order) ?? 0) + 1);
	}
	assert.equal(orders.size, 6);
	assert.ok(Math.max(...orders.values()) - Math.min(...orders.values()) <= 1);
});

test("identity audit rejects duplicated, missing, and unplanned observations", () => {
	const jobs = plannedJobs();
	assert.equal(auditPlannedIdentities(jobs, jobs).exact, true);
	assert.equal(auditPlannedIdentities([...jobs, jobs[0]], jobs).exact, false);
	assert.equal(auditPlannedIdentities(jobs.slice(1), jobs).exact, false);
	assert.equal(auditPlannedIdentities([...jobs.slice(1), { ...jobs[0], variant: "unexpected" }], jobs).exact, false);
});

test("copy-first workflow enforces a recipe copy without grading documentation compliance", async () => {
	const condition = {
		files: { "README.md": "Ordinary documentation" },
		scaffolds: { "recipes/start.ts": "export const helper = 1;\n// Add your task adapter below." },
		requireRecipeCopy: true,
	};
	const session = createToolSession({ condition, check: async () => ({ compile: true, smoke: true }) });
	assert.match((await session.call("write_solution", { source: "export const value = 1;" })).error, /copying/);
	await session.call("copy_file", { path: "README.md" });
	assert.match((await session.call("replace_solution", { before: "Ordinary", after: "Changed" })).error, /Copy/);
	await session.call("copy_file", { path: "recipes/start.ts" });
	assert.equal(
		(
			await session.call("replace_solution", {
				before: "// Add your task adapter below.",
				after: "export const value = helper;",
			})
		).error,
		undefined,
	);
	assert.equal((await session.call("check", {})).smoke, true);
	assert.match(session.source, /export const value = helper/);
	assert.equal(session.trace.filter((entry) => entry.result.error).length, 2);
});

function plannedJobs() {
	return Array.from({ length: 240 }, (_, index) => ({
		taskId: `task-${Math.floor(index / 30)}`,
		seed: index % 2,
		run: Math.floor(index / 6) % 5,
		variant: ["docs", "current", "minimal"][index % 3],
	}));
}
