import { assert, loadSolution, waitFor } from "../_shared.mjs";

const { openBlobChannel } = await loadSolution();
const backing = new Uint8Array([99, 1, 2, 3, 88]);
const channel = await openBlobChannel([["first", backing.subarray(1, 4)]]);
backing.fill(0);

assert.deepEqual([...new Uint8Array(await channel.get("first"))], [1, 2, 3]);
assert.equal(await channel.get("missing"), null);

const values = [];
const subscription = channel.subscribe((value) => values.push(value));
await waitFor(() => values.length === 1);
assert.deepEqual(values[0], { count: 1, bytes: 3, version: 0 });

const input = new Uint8Array([8, 7, 6]);
assert.equal(await channel.put("second", input.subarray(1)), 1);
assert.equal(input.byteLength, 3);
input.fill(9);
assert.deepEqual([...new Uint8Array(await channel.get("second"))], [7, 6]);
await waitFor(() => values.length === 2);
assert.deepEqual(values[1], { count: 2, bytes: 5, version: 1 });

subscription.unsubscribe();
subscription[Symbol.dispose]();
channel.close();
await channel.closed;
