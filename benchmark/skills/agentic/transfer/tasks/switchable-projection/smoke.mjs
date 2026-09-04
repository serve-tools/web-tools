import { assert, flushMicrotasks, loadSolution } from "../_shared.mjs";

const { createSwitchableProjection } = await loadSolution();
const publications = [];
const projection = createSwitchableProjection({ items: [2, 3, 4, 5], offset: 1, limit: 2, enabled: true }, (value) =>
	publications.push(value),
);

assert.equal(publications.length, 0);
assert.deepEqual(projection.snapshot(), [3, 8]);
projection.start();
assert.deepEqual(publications, [[3, 8]]);
projection.start();
projection.setItems([10, 20, 30]);
projection.setWindow(0, 3);
assert.equal(publications.length, 1);
await flushMicrotasks();
assert.deepEqual(publications.at(-1), [10, 40, 90]);

projection.stop();
projection.setItems([7, 8]);
await flushMicrotasks();
assert.equal(publications.length, 2);
projection.start();
assert.deepEqual(publications.at(-1), [7, 16]);
assert.throws(() => projection.setWindow(null, 1), TypeError);
assert.throws(() => projection.setEnabled(null), TypeError);
