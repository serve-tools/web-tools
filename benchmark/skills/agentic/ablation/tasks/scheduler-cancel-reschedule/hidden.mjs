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
	const { cancelThenReschedule } = await loadSolution();
	const reason = new Error("stop");
	const result = await cancelThenReschedule(reason);

	await new Promise((resolve) => setTimeout(resolve, 40));

	assert.deepEqual(result.ran, ["replacement"]);
	assert.equal(result.cancellation, reason);
	assert.equal(observed.length, 2);
	assert.equal(observed[0].executed, false);
	assert.equal(observed[1].executed, true);
	assert.notEqual(observed[0].options.signal, observed[1].options.signal);
	assert.equal(observed[0].options.signal.aborted, true);
	assert.equal(observed[1].options.signal.aborted, false);
	assert.equal(observed[0].options.delay, 30);

	const defaultResult = await cancelThenReschedule();

	assert.deepEqual(defaultResult.ran, ["replacement"]);
	assert.equal(defaultResult.cancellation?.name, "AbortError");
} finally {
	scheduler.postTask = originalPostTask;
	clearInterval(keepAlive);
}
