import { assert, loadSolution, waitFor } from "../_shared.mjs";

const { openCounter } = await loadSolution();
const counter = openCounter(2);

await waitFor(() => counter.values.length === 1);
assert.deepEqual(counter.values, [2]);

counter.stop();
