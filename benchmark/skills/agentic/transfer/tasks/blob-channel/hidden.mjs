import { assert, loadSolution, rejectsWithin, waitFor } from "../_shared.mjs";

const { openBlobChannel } = await loadSolution();
await assert.rejects(openBlobChannel([["", new Uint8Array()]]), TypeError);
await assert.rejects(openBlobChannel([["x", new DataView(new ArrayBuffer(1))]]), TypeError);
const sparseInitial = new Array(2);
sparseInitial[1] = ["x", new Uint8Array()];
await assert.rejects(openBlobChannel(sparseInitial), TypeError);

const duplicate = await openBlobChannel([
	["x", new Uint8Array([1])],
	["x", new Uint8Array([2])],
]);
assert.deepEqual([...new Uint8Array(await duplicate.get("x"))], [2]);
const retainedBuffer = await duplicate.get("x");
new Uint8Array(retainedBuffer)[0] = 99;
assert.deepEqual([...new Uint8Array(await duplicate.get("x"))], [2]);
duplicate.close();
await duplicate.closed;

const channel = await openBlobChannel();
const left = [];
const right = [];
const leftSubscription = channel.subscribe((value) => left.push(value));
const rightSubscription = channel.subscribe((value) => right.push(value));
await waitFor(() => left.length === 1 && right.length === 1);
assert.deepEqual(left[0], { count: 0, bytes: 0, version: 0 });
assert.deepEqual(right[0], left[0]);
left[0].bytes = 99;
assert.deepEqual(right[0], { count: 0, bytes: 0, version: 0 });

let state = 0x12345678;
let totalBytes = 0;
for (let seed = 0; seed < 12; ++seed) {
	const length = seed % 7;
	const backing = new Uint8Array(length + 4).fill(0xee);
	const view = backing.subarray(2, 2 + length);
	for (let index = 0; index < length; ++index) {
		state = (Math.imul(state ^ (state >>> 13), 0x5bd1e995) + seed + index) >>> 0;
		view[index] = state & 0xff;
	}
	const expected = [...view];
	assert.equal(await channel.put(`k${seed}`, view), seed + 1);
	backing.fill(0);
	assert.deepEqual([...new Uint8Array(await channel.get(`k${seed}`))], expected);
	totalBytes += length;
}
await waitFor(() => left.length === 13 && right.length === 13);
assert.deepEqual(right.at(-1), { count: 12, bytes: totalBytes, version: 12 });

leftSubscription.unsubscribe();
leftSubscription[Symbol.dispose]();
await channel.put("k0", new Uint8Array([1, 2]));
await waitFor(() => right.length === 14);
assert.equal(left.length, 13);
assert.deepEqual(right.at(-1), { count: 12, bytes: totalBytes - 0 + 2, version: 13 });

const before = right.length;
for (const [key, bytes] of [
	["", new Uint8Array()],
	["bad", "bytes"],
	[null, new Uint8Array()],
]) {
	await rejectsWithin(channel.put(key, bytes), (error) => error instanceof Error && error.name === "TypeError");
}
assert.equal(await channel.get("k0").then((buffer) => new Uint8Array(buffer).byteLength), 2);
assert.deepEqual([...new Uint8Array(await channel.get("k0"))], [1, 2]);
await new Promise((resolve) => setTimeout(resolve, 0));
assert.equal(right.length, before);

channel.close("done");
channel.close("again");
await channel.closed;
rightSubscription.unsubscribe();
await rejectsWithin(channel.get("k0"), Error);
await rejectsWithin(channel.put("later", new Uint8Array()), Error);
