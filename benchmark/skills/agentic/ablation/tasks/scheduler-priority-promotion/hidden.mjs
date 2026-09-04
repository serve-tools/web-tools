import { scheduler } from "@serve-tools/ponyfill-prioritized-task-scheduling";
import { assert, loadSolution } from "../_shared.mjs";

const keepAlive = setInterval(() => {}, 50);
const originalPostTask = scheduler.postTask;
const observed = [];

scheduler.postTask = function (callback, options) {
	const record = { options, executed: false };

	observed.push(record);

	return originalPostTask.call(
		this,
		(...arguments_) => {
			record.executed = true;

			return callback(...arguments_);
		},
		options,
	);
};

try {
	const { runPromotedOrder } = await loadSolution();

	assert.deepEqual(await runPromotedOrder(["a", "b"]), ["a", "b"]);
	assert.equal(observed.length, 2);
	assert.equal(
		observed.every(({ executed }) => executed),
		true,
	);
	assert.equal(observed[0].options.signal.priority, "user-blocking");
	assert.equal(observed[0].options.priority, undefined);
	assert.equal(observed[1].options.priority, "user-visible");
	await assert.rejects(runPromotedOrder(["a"]), TypeError);
	await assert.rejects(runPromotedOrder(["a", 2]), TypeError);
	await assert.rejects(runPromotedOrder(new Array(2)), TypeError);
} finally {
	scheduler.postTask = originalPostTask;
	clearInterval(keepAlive);
}
