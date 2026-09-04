import { assert, loadSolution, rejectsWithin, waitFor } from "../_shared.mjs";

const { openDocumentChannel } = await loadSolution();

await assert.rejects(openDocumentChannel(1), TypeError);

const channel = await openDocumentChannel();
const left = [];
const right = [];
const firstLeft = Promise.withResolvers();
const firstRight = Promise.withResolvers();
const leftSubscription = channel.subscribe((value) => {
	left.push(value);
	firstLeft.resolve();
});
const rightSubscription = channel.subscribe((value) => {
	right.push(value);
	firstRight.resolve();
});

await Promise.all([firstLeft.promise, firstRight.promise]);
assert.deepEqual(left, [{ text: "", version: 0 }]);
assert.deepEqual(right, [{ text: "", version: 0 }]);

leftSubscription[Symbol.dispose]();
leftSubscription.unsubscribe();
assert.equal(await channel.replace(""), 0);
assert.equal(await channel.replace("next"), 4);

await waitFor(() => right.length >= 3);
assert.equal(left.length, 1);
assert.deepEqual(right, [
	{ text: "", version: 0 },
	{ text: "", version: 1 },
	{ text: "next", version: 2 },
]);

await rejectsWithin(channel.replace(1), (error) => error instanceof Error && error.name === "TypeError");

channel.close("done");
channel.close("again");
await channel.closed;
rightSubscription.unsubscribe();
await rejectsWithin(channel.read(), Error);
