import { assert, flushMicrotasks, loadSolution, rejectsWithin, waitFor } from "../_shared.mjs";

const { openEventChannel } = await loadSolution();

for (const initial of [
	null,
	[{ topic: "", value: 1 }],
	[{ topic: "a", value: Number.NaN }],
	[{ topic: "a", value: Number.POSITIVE_INFINITY }],
	[{ topic: "a", value: Number.NEGATIVE_INFINITY }],
	[{ topic: "a" }],
	Array(1),
]) {
	await assert.rejects(openEventChannel(initial), TypeError);
}

const original = { topic: "initial", value: 2.5, ignored: true };
const channel = await openEventChannel([original]);
original.topic = "changed";
original.value = 99;
assert.deepEqual(await channel.list("initial"), [{ topic: "initial", value: 2.5 }]);

const seenA = [];
const seenB = [];
const handleA = channel.watch("a", (record) => {
	seenA.push(record);
	record.value = 100;
});
const handleB = channel.watch("b", (record) => seenB.push(record));
await flushMicrotasks();
assert.deepEqual(seenA, []);
assert.deepEqual(seenB, []);

await channel.append("b", 1.5);
await channel.append("b", 2.5);
await waitFor(() => seenB.length === 2);
assert.deepEqual(seenA, []);
assert.deepEqual(seenB, [
	{ topic: "b", value: 1.5 },
	{ topic: "b", value: 2.5 },
]);

await channel.append("a", 3.5);
await waitFor(() => seenA.length === 1);
assert.deepEqual(seenA, [{ topic: "a", value: 100 }]);
const listedA = await channel.list("a");
assert.deepEqual(listedA, [{ topic: "a", value: 3.5 }]);
listedA[0].value = -1;
assert.deepEqual(await channel.list("a"), [{ topic: "a", value: 3.5 }]);

await assert.rejects(channel.append("", 7), (error) => error?.name === "TypeError");
await assert.rejects(channel.append("a", Number.POSITIVE_INFINITY), (error) => error?.name === "TypeError");
await assert.rejects(channel.append("a", Number.NEGATIVE_INFINITY), (error) => error?.name === "TypeError");
await assert.rejects(channel.list(""), (error) => error?.name === "TypeError");
assert.deepEqual(await channel.list("a"), [{ topic: "a", value: 3.5 }]);
assert.equal(seenA.length, 1);
assert.throws(() => channel.watch("a", null), TypeError);

handleA.unsubscribe();
handleA.unsubscribe();
await channel.append("a", 4.5);
await flushMicrotasks();
assert.equal(seenA.length, 1);
handleB.unsubscribe();

const possiblyPending = channel.append("close", 1);
channel.close(new Error("close"));
channel.close();
const settled = await Promise.race([
	possiblyPending.then(
		() => "fulfilled",
		() => "rejected",
	),
	new Promise((resolve) => setTimeout(() => resolve("timeout"), 200)),
]);
assert.notEqual(settled, "timeout");
await channel.closed;
await rejectsWithin(channel.append("later", 1), () => true);
await rejectsWithin(channel.list("later"), () => true);
assert.throws(() => channel.watch("later", () => {}));
