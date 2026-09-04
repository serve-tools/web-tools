import assert from "node:assert/strict";
import test from "node:test";
import { createBlockedJobs } from "../run.mjs";
import { analyze } from "./analyze.mjs";
import { createAblationConditions } from "./conditions.mjs";
import { settings } from "./settings.mjs";
import { relativeInterval, signFlipInterval } from "./statistics.mjs";

test("short-guide arms differ only by optional helper availability", async () => {
	const { minimal, helpers } = await createAblationConditions(process.cwd());
	assert.equal(minimal.discovery, helpers.discovery);
	assert.equal(minimal.files["guide/SKILL.md"], helpers.files["guide/SKILL.md"]);
	assert.deepEqual(
		Object.fromEntries(Object.entries(helpers.files).filter(([file]) => file !== "recipes/INDEX.md")),
		minimal.files,
	);
	assert.equal(Object.keys(minimal.scaffolds).length, 0);
	assert.equal(Object.keys(helpers.scaffolds).length, 12);
	assert.deepEqual(
		Object.keys(minimal.files).filter((file) => file.startsWith("recipes/")),
		[],
	);
	assert.deepEqual(
		Object.keys(helpers.scaffolds).sort(),
		helpers.recipeManifest.map((helper) => `recipes/${helper.file}`).sort(),
	);
	assert.equal(minimal.requireRecipeCopy, undefined);
	assert.equal(helpers.requireRecipeCopy, undefined);
});

test("analysis records matched pairs and fails closed on corrupted measurements", () => {
	const tasks = Array.from({ length: 24 }, (_, index) => ({ id: `task-${index}`, family: `family-${index >> 1}` }));
	const jobs = createBlockedJobs(tasks, settings);
	const plan = { metadata: { completedPlan: true, stopReason: null }, tasks, jobs };
	const records = jobs.map((job) => ({
		...job,
		pass: false,
		elapsedMs: 1_000,
		usageComplete: true,
		usage: { inputTokens: 100, cachedInputTokens: 20, outputTokens: 50 },
	}));
	const clean = analyze(records, plan);
	assert.equal(clean.comparisons[0].pairAccounting.expectedPairs, 48);
	assert.equal(clean.comparisons[0].pairAccounting.completePairs, 48);
	assert.equal(clean.comparisons[0].pairAccounting.discordantPairs, 0);
	assert.equal(clean.zeroDiscordanceCaution.observedPairs, 48);
	assert.ok(clean.zeroDiscordanceCaution.familyAnyDiscordanceUpper95 > 0);

	const discordant = records.map((record) => ({ ...record }));
	discordant.find((record) => record.variant === "helpers").pass = true;
	const paired = analyze(discordant, plan);
	assert.equal(paired.comparisons[0].pairAccounting.discordantPairs, 1);
	assert.equal(paired.zeroDiscordanceCaution, null);

	const corrupted = records.map((record) => ({ ...record }));
	corrupted[0].elapsedMs = Number.NaN;
	corrupted[1].pass = 1;
	const invalid = analyze(corrupted, plan);
	assert.equal(invalid.validity.elapsed, false);
	assert.equal(invalid.validity.booleanPasses, false);
	assert.equal(invalid.comparisons[0].success, null);
	assert.equal(invalid.comparisons[0].elapsed, null);
	assert.equal(invalid.gate.checks.validBooleanPasses, false);
	assert.equal(invalid.gate.checks.validElapsed, false);
});

test("192 matched attempts balance every four-arm permutation within each seed", () => {
	const tasks = Array.from({ length: 24 }, (_, index) => ({ id: `task-${index}` }));
	const jobs = createBlockedJobs(tasks, settings);
	assert.equal(jobs.length, 192);
	assert.equal(new Set(jobs.map((job) => JSON.stringify(job))).size, 192);
	for (const seed of settings.seeds) {
		const group = jobs.filter((job) => job.seed === seed);
		const orders = new Set();
		for (let index = 0; index < group.length; index += 4) {
			const block = group.slice(index, index + 4);
			assert.equal(new Set(block.map((job) => job.taskId)).size, 1);
			assert.deepEqual(block.map((job) => job.variant).sort(), [...settings.variants].sort());
			orders.add(block.map((job) => job.variant).join(","));
		}
		assert.equal(orders.size, 24);
	}
});

test("family inference does not turn zero observed variation into equivalence", () => {
	assert.equal(signFlipInterval(Array(12).fill(0)).interval, null);
	assert.equal(signFlipInterval(Array(12).fill(0.25)).degenerate, true);
	assert.equal(signFlipInterval(Array(11).fill(0.25)).interval, null);
	const symmetric = [-0.6, -0.5, -0.4, -0.3, -0.2, -0.1, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6];
	const result = signFlipInterval(symmetric);
	assert.equal(result.pAtZero, 1);
	assert.ok(result.interval[0] < 0 && result.interval[1] > 0);
	assert.ok(Math.abs(result.interval[0] + result.interval[1]) < 0.0041);
	const positive = signFlipInterval(Array.from({ length: 12 }, (_, index) => 0.1 + index * 0.002));
	assert.equal(positive.pAtZero, 2 / 4096);
	assert.ok(positive.interval[0] > 0);
	const saving = relativeInterval(Array.from({ length: 12 }, (_, index) => Math.log(0.65 + index * 0.001)));
	assert.ok(saving.interval[1] < -0.3);
});
