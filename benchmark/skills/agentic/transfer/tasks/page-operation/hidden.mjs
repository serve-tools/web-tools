import { assert, flushMicrotasks, loadSolution, rejectsWithin, waitFor } from "../_shared.mjs";

const { createPageOperation } = await loadSolution();

assert.throws(() => createPageOperation([], null), TypeError);
assert.throws(() => createPageOperation(null, () => 0), TypeError);
assert.throws(() => createPageOperation(1, () => 0), TypeError);
assert.throws(() => createPageOperation([], () => 0, "options"), TypeError);

let started = 0;
const backpressured = createPageOperation([1, 2, 3], (page) => {
	++started;
	return page;
});
await flushMicrotasks(4);
assert.equal(started, 1);
const iterator = backpressured[Symbol.asyncIterator]();
assert.deepEqual(await iterator.next(), { done: false, value: { page: 1, index: 0, records: 1 } });
await flushMicrotasks(4);
assert.equal(started, 2);
await iterator.return();
await rejectsWithin(backpressured.result, (reason) => reason === backpressured.signal.reason);
await backpressured.finished;

const explicitZero = createPageOperation([1, 2], (page) => page, { highWaterMark: 0 });
await flushMicrotasks(4);
const explicitIterator = explicitZero[Symbol.asyncIterator]();
assert.deepEqual(await explicitIterator.next(), { done: false, value: { page: 1, index: 0, records: 1 } });
await explicitIterator.return();
await explicitZero.finished;

const bufferedStarted = [];
const buffered = createPageOperation(
	[4, 5, 6],
	(page) => {
		bufferedStarted.push(page);
		return 1;
	},
	{ highWaterMark: 1 },
);
await flushMicrotasks(6);
await waitFor(() => bufferedStarted.length === 2);
assert.deepEqual(bufferedStarted, [4, 5]);
const bufferedIterator = buffered[Symbol.asyncIterator]();
await bufferedIterator.return();
await buffered.finished;

const sparse = new Array(3);
sparse[0] = 1;
sparse[2] = 3;
const visited = [];
const sparseOperation = createPageOperation(sparse, (page) => {
	visited.push(page);
	return 0;
});
await assert.rejects(
	(async () => {
		for await (const _ of sparseOperation) {
			// Drain until invalid sparse item.
		}
	})(),
	TypeError,
);
assert.deepEqual(visited, [1]);

for (const pages of [[0], [-1], [1.5], [Number.MAX_SAFE_INTEGER + 1]]) {
	const invalid = createPageOperation(pages, () => 0);
	await assert.rejects(invalid.result, TypeError);
}
for (const count of [-1, 1.5, Number.MAX_SAFE_INTEGER + 1, Number.NaN]) {
	const invalid = createPageOperation([1], () => count);
	await assert.rejects(invalid.result, TypeError);
}
assert.throws(() => createPageOperation([], () => 0, null), TypeError);
assert.throws(() => createPageOperation([], () => 0, { signal: {} }), TypeError);

for (let seed = 1; seed <= 12; ++seed) {
	const pages = Array.from({ length: seed % 5 }, (_, index) => seed + index + 1);
	const operation = createPageOperation(pages, (page, index) => page * 2 + index, { highWaterMark: 8 });
	const output = [];
	for await (const value of operation) {
		output.push(value);
	}
	assert.deepEqual(
		output,
		pages.map((page, index) => ({ page, index, records: page * 2 + index })),
	);
	assert.deepEqual(await operation.result, {
		pages: pages.length,
		records: pages.reduce((sum, page, index) => sum + page * 2 + index, 0),
	});
}

const zero = createPageOperation([1], () => 0, { highWaterMark: 1 });
assert.deepEqual(await zero.result, { pages: 1, records: 0 });

const reason = new Error("upstream");
const upstream = new AbortController();
let cleaned = false;
const cancelled = createPageOperation(
	[1],
	(_page, _index, signal) =>
		new Promise((_resolve, reject) => {
			signal.addEventListener(
				"abort",
				() => {
					queueMicrotask(() => {
						cleaned = true;
						reject(signal.reason);
					});
				},
				{ once: true },
			);
		}),
	{ signal: upstream.signal },
);
upstream.abort(reason);
await rejectsWithin(cancelled.result, (error) => error === reason);
assert.equal(cancelled.signal.reason, reason);
await cancelled.finished;
assert.equal(cleaned, true);

const resolvesAfterAbort = new AbortController();
const lateValues = [];
const late = createPageOperation(
	[1],
	(_page, _index, signal) =>
		new Promise((resolve) => signal.addEventListener("abort", () => resolve(1), { once: true })),
	{ signal: resolvesAfterAbort.signal, highWaterMark: 1 },
);
resolvesAfterAbort.abort(reason);
await rejectsWithin(late.result, (error) => error === reason);
await assert.rejects(
	(async () => {
		for await (const value of late) {
			lateValues.push(value);
		}
	})(),
	(error) => error === reason,
);
assert.deepEqual(lateValues, []);

const manualReason = { kind: "manual" };
let manualCleaned = false;
const manual = createPageOperation(
	[1],
	(_page, _index, signal) =>
		new Promise((_resolve, reject) =>
			signal.addEventListener(
				"abort",
				() => {
					queueMicrotask(() => {
						manualCleaned = true;
						reject(signal.reason);
					});
				},
				{ once: true },
			),
		),
);
manual.abort(manualReason);
await rejectsWithin(manual.result, (error) => error === manualReason);
await manual.finished;
assert.equal(manualCleaned, true);

let returnCleaned = false;
const returned = createPageOperation([1, 2], (page, _index, signal) =>
	page === 1
		? 1
		: new Promise((_resolve, reject) =>
				signal.addEventListener(
					"abort",
					() => {
						queueMicrotask(() => {
							returnCleaned = true;
							reject(signal.reason);
						});
					},
					{ once: true },
				),
			),
);
const returnedIterator = returned[Symbol.asyncIterator]();
await returnedIterator.next();
const returnPromise = returnedIterator.return();
await returnPromise;
await returned.finished;
assert.equal(returnCleaned, true);

const disposed = createPageOperation(
	[1],
	(_page, _index, signal) =>
		new Promise((_resolve, reject) =>
			signal.addEventListener("abort", () => reject(signal.reason), { once: true }),
		),
);
await disposed[Symbol.asyncDispose]();
assert.equal(disposed.signal.aborted, true);
await disposed.finished;
