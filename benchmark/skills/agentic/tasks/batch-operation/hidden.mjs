import { assert, flushMicrotasks, loadSolution, rejectsWithin } from "../_shared.mjs";

const { createBatchOperation } = await loadSolution();

let started = 0;
const backpressured = createBatchOperation([1, 2, 3], (value) => {
	++started;
	return value;
});

await flushMicrotasks(4);
assert.equal(started, 1, "zero-capacity delivery must stop producer run-ahead");

const iterator = backpressured[Symbol.asyncIterator]();
assert.deepEqual(await iterator.next(), { done: false, value: { index: 0, status: "fulfilled", value: 1 } });
await flushMicrotasks(4);
assert.equal(started, 2);
await iterator.return();
await rejectsWithin(backpressured.result, (reason) => reason === backpressured.signal.reason);
await backpressured.finished;
assert.equal(backpressured.signal.aborted, true);

const upstreamReason = new Error("upstream stopped");
const upstream = new AbortController();
const cancelled = createBatchOperation(
	[1],
	(_value, _index, signal) =>
		new Promise((_resolve, reject) =>
			signal.addEventListener("abort", () => reject(signal.reason), { once: true }),
		),
	{ signal: upstream.signal, highWaterMark: 1 },
);

upstream.abort(upstreamReason);
await rejectsWithin(cancelled.result, (reason) => reason === upstreamReason);
await cancelled.finished;
assert.equal(cancelled.signal.reason, upstreamReason);

assert.throws(() => createBatchOperation([], () => 0, { highWaterMark: 1.5 }), TypeError);

const defaulted = createBatchOperation([], () => 0, { highWaterMark: undefined });
assert.deepEqual(await defaulted.result, { fulfilled: 0, rejected: 0 });
await defaulted.finished;

await rejectsInvalidHighWaterMark(() => createBatchOperation([], () => 0, { highWaterMark: null }));

async function rejectsInvalidHighWaterMark(create) {
	let operation;

	try {
		operation = create();
	} catch {
		return;
	}

	assert.equal(
		typeof operation?.result?.then,
		"function",
		"invalid construction must throw or return a failing operation",
	);
	await assert.rejects(operation.result);
}
