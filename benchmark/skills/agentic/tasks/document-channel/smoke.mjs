import { assert, loadSolution, waitFor } from "../_shared.mjs";

const { openDocumentChannel } = await loadSolution();
assert.equal(typeof openDocumentChannel, "function");

const channel = await openDocumentChannel("hi");
const first = Promise.withResolvers();
const values = [];
const subscription = channel.subscribe((value) => {
	values.push(value);
	first.resolve();
});

await first.promise;
assert.deepEqual(values, [{ text: "hi", version: 0 }]);
assert.equal(await channel.read(), "hi");
assert.equal(await channel.replace("hé"), 3);

await waitFor(() => values.length >= 2);
assert.deepEqual(values.at(-1), { text: "hé", version: 1 });

const buffer = await channel.bytes();
assert.equal(buffer instanceof ArrayBuffer, true);
assert.equal(new TextDecoder().decode(buffer), "hé");

subscription.unsubscribe();
channel.close();
await channel.closed;
