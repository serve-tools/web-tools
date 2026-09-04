import { assert, loadSolution } from "../_shared.mjs";

const { createProgressFold } = await loadSolution();
const operation = createProgressFold([1, 2], 0, (total, value) => total + value);

assert.deepEqual(await Array.fromAsync(operation), [
	{ index: 0, total: 1 },
	{ index: 1, total: 3 },
]);
assert.equal(await operation.result, 3);
