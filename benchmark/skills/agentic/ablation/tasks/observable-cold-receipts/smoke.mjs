import { assert, loadSolution } from "../_shared.mjs";

const { collectReceipts } = await loadSolution();
let run = 0;
const result = await collectReceipts(
	() => ++run,
	() => {},
);

assert.deepEqual(result[0], [2, 4]);
