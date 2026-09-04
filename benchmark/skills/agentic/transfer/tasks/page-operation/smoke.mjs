import { assert, loadSolution } from "../_shared.mjs";

const { createPageOperation } = await loadSolution();
const operation = createPageOperation([3, 1, 4], async (page, index) => page + index);
const values = [];

for await (const value of operation) {
	values.push(value);
}

assert.deepEqual(values, [
	{ page: 3, index: 0, records: 3 },
	{ page: 1, index: 1, records: 2 },
	{ page: 4, index: 2, records: 6 },
]);
assert.deepEqual(await operation.result, { pages: 3, records: 11 });
await operation.finished;
assert.equal(operation.signal.aborted, false);

assert.throws(() => createPageOperation([], () => 0, { highWaterMark: null }), TypeError);
assert.throws(() => createPageOperation([], () => 0, { highWaterMark: 1.5 }), TypeError);

const failure = new Error("load failed");
const failed = createPageOperation([1, 2], (page) => {
	if (page === 2) {
		throw failure;
	}
	return 1;
});
await assert.rejects(
	(async () => {
		for await (const _ of failed) {
			// Drain the first value.
		}
	})(),
	(reason) => reason === failure,
);
await assert.rejects(failed.result, (reason) => reason === failure);
