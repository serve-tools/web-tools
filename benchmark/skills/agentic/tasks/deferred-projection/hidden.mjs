import { assert, flushMicrotasks, loadSolution } from "../_shared.mjs";

const { createDeferredProjection } = await loadSolution();

assert.throws(() => createDeferredProjection({ items: new Array(1), limit: 1, enabled: true }, () => {}), TypeError);

const disabledPublications = [];
const projection = createDeferredProjection({ items: [2], limit: 1, enabled: false }, (value) =>
	disabledPublications.push(value),
);
projection.start();
assert.deepEqual(disabledPublications, [[]]);

const source = [3, 4];
projection.setItems(source);
source[0] = 100;
projection.setLimit(2);
await flushMicrotasks();
assert.equal(disabledPublications.length, 1, "disabled projections must not depend on items or limit");
projection.setEnabled(true);
await flushMicrotasks();
assert.deepEqual(disabledPublications.at(-1), [9, 16]);

const copy = projection.snapshot();
copy[0] = 999;
assert.deepEqual(projection.snapshot(), [9, 16]);

projection.setItems([5]);
projection.dispose();
await flushMicrotasks();
assert.equal(disabledPublications.length, 2, "dispose must cancel a queued run");
assert.deepEqual(projection.snapshot(), [25]);

const never = [];
const disposed = createDeferredProjection({ items: [1], limit: 1, enabled: true }, (value) => never.push(value));
disposed.dispose();
disposed.start();
assert.deepEqual(never, []);

assert.throws(() => projection.setItems([1, Number.NaN]), TypeError);
assert.throws(() => projection.setLimit(-1), TypeError);
assert.throws(() => projection.setEnabled(1), TypeError);

const validatedPublications = [];
const validated = createDeferredProjection({ items: [2], limit: 1, enabled: true }, (value) =>
	validatedPublications.push(value),
);
validated.start();
assert.throws(() => validated.setItems(new Array(1)), TypeError);
await flushMicrotasks();
assert.deepEqual(validated.snapshot(), [4]);
assert.deepEqual(validatedPublications, [[4]]);
validated.dispose();
