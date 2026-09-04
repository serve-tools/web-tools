import { assert, loadSolution } from "../_shared.mjs";

const { openDelayedEcho } = await loadSolution();
const waits = [];
const channel = await openDelayedEcho(async (delay, signal) => {
	waits.push([delay, signal]);
});

assert.equal(await channel.echo("hi", 0), "hi");
assert.equal(waits.length, 1);
assert.equal(waits[0][0], 0);
assert.ok(waits[0][1] instanceof AbortSignal);
channel.close();
await channel.closed;
