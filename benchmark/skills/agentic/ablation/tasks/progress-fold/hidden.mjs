import { assert, flushMicrotasks, loadSolution, waitFor } from "../_shared.mjs";

const { createProgressFold } = await loadSolution();

const empty = createProgressFold([], 7, () => {
	throw new Error("empty fold");
});
assert.deepEqual(await Array.fromAsync(empty), []);
assert.equal(await empty.result, 7);

const foldCalls = [];
const backpressured = createProgressFold(
	[2, 3],
	1,
	async (total, value, index, signal) => {
		foldCalls.push({ total, value, index, signal });
		return total * value;
	},
	{ highWaterMark: 0, unrelated: true },
);
await waitFor(() => foldCalls.length === 1);
await flushMicrotasks();
assert.equal(foldCalls.length, 1);
const progress = await Array.fromAsync(backpressured);
assert.deepEqual(progress, [
	{ index: 0, total: 2 },
	{ index: 1, total: 6 },
]);
assert.equal(await backpressured.result, 6);
assert.deepEqual(
	foldCalls.map(({ total, value, index }) => ({ total, value, index })),
	[
		{ total: 1, value: 2, index: 0 },
		{ total: 2, value: 3, index: 1 },
	],
);
assert.ok(foldCalls.every(({ signal }) => signal instanceof AbortSignal));

const invalidResult = createProgressFold([1], 0, () => Number.NaN);
const invalidConsumption = Array.fromAsync(invalidResult);
await assert.rejects(invalidResult.result, TypeError);
await assert.rejects(invalidConsumption, TypeError);
await invalidResult.finished;

for (const create of [
	() => createProgressFold(null, 0, () => 0),
	() => createProgressFold(Object.assign(Array(3), { 0: 1, 2: 2 }), 0, () => 0),
	() => createProgressFold([Number.POSITIVE_INFINITY], 0, () => 0),
	() => createProgressFold([Number.NEGATIVE_INFINITY], 0, () => 0),
	() => createProgressFold([], Number.NaN, () => 0),
	() => createProgressFold([], Number.NEGATIVE_INFINITY, () => 0),
	() => createProgressFold([], 0, null),
	() => createProgressFold([], 0, () => 0, null),
	() => createProgressFold([], 0, () => 0, { highWaterMark: -1 }),
	() => createProgressFold([], 0, () => 0, { highWaterMark: 1.5 }),
	() => createProgressFold([], 0, () => 0, { highWaterMark: Number.POSITIVE_INFINITY }),
	() => createProgressFold([], 0, () => 0, { highWaterMark: null }),
	() => createProgressFold([], 0, () => 0, { signal: {} }),
]) {
	await assert.rejects(Promise.resolve().then(create), TypeError);
}

let enterFold;
const entered = new Promise((resolve) => {
	enterFold = resolve;
});
let releaseFold;
const release = new Promise((resolve) => {
	releaseFold = resolve;
});
let observedAbort = false;
const cancelled = createProgressFold([1, 2], 0, async (_total, _value, _index, signal) => {
	enterFold();
	await new Promise((resolve) => signal.addEventListener("abort", resolve, { once: true }));
	observedAbort = true;
	await release;
	return 1;
});
await entered;
const reason = new Error("stop");
cancelled.abort(reason);
await waitFor(() => observedAbort);
let finished = false;
void cancelled.finished.then(() => {
	finished = true;
});
await Promise.resolve();
assert.equal(finished, false);
releaseFold();
await assert.rejects(cancelled.result, (error) => error === reason);
await cancelled.finished;
assert.equal(finished, true);

const controller = new AbortController();
let externalEntered;
const externalReady = new Promise((resolve) => {
	externalEntered = resolve;
});
const externallyCancelled = createProgressFold(
	[1],
	0,
	async (_total, _value, _index, signal) => {
		externalEntered();
		await new Promise((resolve) => signal.addEventListener("abort", resolve, { once: true }));
		return 1;
	},
	{ signal: controller.signal },
);
await externalReady;
const externalReason = new Error("external");
controller.abort(externalReason);
await assert.rejects(externallyCancelled.result, (error) => error === externalReason);
await externallyCancelled.finished;
