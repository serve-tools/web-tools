import { assert, flushMicrotasks, loadSolution, rejectsWithin, waitFor } from "../_shared.mjs";

const { openDelayedEcho } = await loadSolution();

await assert.rejects(openDelayedEcho(null), TypeError);

let invalidCalls = 0;
const validationChannel = await openDelayedEcho(() => {
	++invalidCalls;
});
for (const [text, delay] of [
	["", 0],
	[null, 0],
	["x", -1],
	["x", 1.5],
	["x", Number.POSITIVE_INFINITY],
	["x", Number.MAX_SAFE_INTEGER + 1],
]) {
	await assert.rejects(validationChannel.echo(text, delay), (error) => error?.name === "TypeError");
}
await assert.rejects(validationChannel.echo("x", 0, {}), TypeError);
assert.equal(invalidCalls, 0);
validationChannel.close();
validationChannel.close();
await validationChannel.closed;

let entered;
const waitEntered = new Promise((resolve) => {
	entered = resolve;
});
let release;
const releaseWait = new Promise((resolve) => {
	release = resolve;
});
let requestSignal;
let observedAbort = false;
let waitSettled = false;
const abortChannel = await openDelayedEcho(async (delay, signal) => {
	assert.equal(delay, 4);
	requestSignal = signal;
	entered();
	await new Promise((resolve) => signal.addEventListener("abort", resolve, { once: true }));
	observedAbort = true;
	await releaseWait;
	waitSettled = true;
});
const controller = new AbortController();
const pending = abortChannel.echo("value", 4, controller.signal);
let pendingSettled = false;
const pendingOutcome = pending.then(
	(value) => {
		pendingSettled = true;
		return { value };
	},
	(error) => {
		pendingSettled = true;
		return { error };
	},
);
await waitEntered;
const abortReason = new Error("cancel echo");
controller.abort(abortReason);
await waitFor(() => observedAbort);
assert.equal(requestSignal.aborted, true);
await flushMicrotasks();
assert.equal(pendingSettled, true);
assert.deepEqual(await pendingOutcome, { error: abortReason });
release();
await waitFor(() => waitSettled);
abortChannel.close();
await abortChannel.closed;

let closeEntered;
const closeReady = new Promise((resolve) => {
	closeEntered = resolve;
});
let closeSignalAborted = false;
const closingChannel = await openDelayedEcho(async (_delay, signal) => {
	closeEntered();
	await new Promise((resolve) => signal.addEventListener("abort", resolve, { once: true }));
	closeSignalAborted = true;
});
const closingRequest = closingChannel.echo("pending", 1);
await closeReady;
closingChannel.close(new Error("close"));
closingChannel.close();
await rejectsWithin(closingRequest, () => true);
await waitFor(() => closeSignalAborted);
await closingChannel.closed;
await rejectsWithin(closingChannel.echo("later", 0), () => true);
