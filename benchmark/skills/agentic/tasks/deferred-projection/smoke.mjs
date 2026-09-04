import { assert, flushMicrotasks, loadSolution } from "../_shared.mjs";

const { createDeferredProjection } = await loadSolution();
assert.equal(typeof createDeferredProjection, "function");

const published = [];
const projection = createDeferredProjection({ items: [2, 3, 4], limit: 2, enabled: true }, (value) =>
	published.push(value),
);

assert.deepEqual(projection.snapshot(), [4, 9]);
assert.deepEqual(published, []);
projection.start();
projection.start();
assert.deepEqual(published, [[4, 9]]);

projection.setLimit(3);
projection.setItems([1, 2, 3]);
assert.equal(published.length, 1);
await flushMicrotasks();
assert.deepEqual(published.at(-1), [1, 4, 9]);
projection.dispose();
