import { assert, loadSolution } from "../_shared.mjs";

const { createBatchOperation } = await loadSolution();
assert.equal(typeof createBatchOperation, "function");

const failure = new Error("bad item");
const operation = createBatchOperation([2, 3, 4], (value) => {
	if (value === 3) {
		throw failure;
	}
	return value * 2;
});
const observations = [];

for await (const observation of operation) {
	observations.push(observation);
}

assert.deepEqual(observations, [
	{ index: 0, status: "fulfilled", value: 4 },
	{ index: 1, status: "rejected", reason: failure },
	{ index: 2, status: "fulfilled", value: 8 },
]);
assert.deepEqual(await operation.result, { fulfilled: 2, rejected: 1 });
await operation.finished;
assert.equal(operation.signal.aborted, false);
assert.throws(() => createBatchOperation([], () => 0, { highWaterMark: -1 }), TypeError);
