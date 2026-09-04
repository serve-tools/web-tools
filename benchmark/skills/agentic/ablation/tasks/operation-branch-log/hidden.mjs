import { assert, loadSolution } from "../_shared.mjs";

const { collectEvenSquares } = await loadSolution();

const seen = [];
const result = await collectEvenSquares([6, -2, 3, 8], async (value, index) => {
	await Promise.resolve();
	seen.push([value, index]);
});
assert.deepEqual(result, { all: 4, evens: [36, 4, 64] });
assert.deepEqual(seen, [
	[36, 0],
	[4, 1],
	[64, 2],
]);
assert.deepEqual(Object.keys(result), ["all", "evens"]);

const second = await collectEvenSquares([], () => {
	throw new Error("empty listener");
});
assert.deepEqual(second, { all: 0, evens: [] });
assert.notEqual(result, second);
assert.notEqual(result.evens, second.evens);

let listenerCalls = 0;
for (const invoke of [
	() => collectEvenSquares(null, () => ++listenerCalls),
	() => collectEvenSquares(Object.assign(Array(3), { 0: 1, 2: 2 }), () => ++listenerCalls),
	() => collectEvenSquares([Number.NaN], () => ++listenerCalls),
	() => collectEvenSquares([Number.POSITIVE_INFINITY], () => ++listenerCalls),
	() => collectEvenSquares([Number.NEGATIVE_INFINITY], () => ++listenerCalls),
	() => collectEvenSquares([], null),
]) {
	await assert.rejects(Promise.resolve().then(invoke), TypeError);
}
assert.equal(listenerCalls, 0);

const failure = new Error("listener");
const failedValues = [];
await assert.rejects(
	collectEvenSquares([2, 4, 6], (value) => {
		failedValues.push(value);
		throw failure;
	}),
	(error) => error === failure,
);
assert.deepEqual(failedValues, [4]);
