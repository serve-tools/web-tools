import { assert, loadSolution, waitFor } from "../_shared.mjs";

const { openCounter } = await loadSolution();
const counter = openCounter(9);

assert.equal(counter.cleanupCount, 0);
await waitFor(() => counter.values.length === 1);
assert.deepEqual(counter.values, [9]);

counter.stop();
counter.stop();

await counter.closed;
assert.equal(counter.cleanupCount, 1);
assert.throws(() => openCounter(Number.NaN), TypeError);
assert.throws(() => openCounter(Infinity), TypeError);
