import { assert, loadSolution } from "../_shared.mjs";

const { collectEvenSquares } = await loadSolution();
const seen = [];
const result = await collectEvenSquares([1, 2, 4], (value, index) => seen.push([value, index]));

assert.deepEqual(result, { all: 3, evens: [4, 16] });
assert.deepEqual(seen, [
	[4, 0],
	[16, 1],
]);
