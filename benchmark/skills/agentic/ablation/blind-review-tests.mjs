import assert from "node:assert/strict";
import test from "node:test";
import { createBlockedJobs } from "../run.mjs";
import { selectReview } from "./blind-review.mjs";
import { settings } from "./settings.mjs";

test("blind review samples one attempt per task and condition independent of outcomes and ordering", () => {
	const tasks = Array.from({ length: 24 }, (_, index) => ({ id: `task-${index}` }));
	const jobs = createBlockedJobs(tasks, settings);
	const selected = selectReview(
		jobs,
		tasks.map((task) => task.id),
	);
	assert.equal(selected.length, 96);
	assert.equal(new Set(selected.map((row) => `${row.taskId}/${row.variant}`)).size, 96);
	assert.deepEqual(
		selectReview(
			[...jobs].reverse().map((job) => ({ ...job, pass: false })),
			tasks.map((task) => task.id),
		),
		selected,
	);
	assert.throws(() =>
		selectReview(
			jobs.slice(1),
			tasks.map((task) => task.id),
		),
	);
});
