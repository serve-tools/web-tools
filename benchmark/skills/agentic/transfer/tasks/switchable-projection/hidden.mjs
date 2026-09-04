import { assert, flushMicrotasks, loadSolution } from "../_shared.mjs";

const { createSwitchableProjection } = await loadSolution();

const sparse = new Array(3);
sparse[2] = 1;
assert.throws(
	() => createSwitchableProjection({ items: sparse, offset: 0, limit: 1, enabled: true }, () => {}),
	TypeError,
);
for (const initial of [
	{ items: [1, Number.NaN], offset: 0, limit: 1, enabled: true },
	{ items: [1], offset: -1, limit: 1, enabled: true },
	{ items: [1], offset: 0, limit: 1.5, enabled: true },
	{ items: [1], offset: 0, limit: 1, enabled: null },
]) {
	assert.throws(() => createSwitchableProjection(initial, () => {}), TypeError);
}

const publications = [];
const source = [1, 2, 3, 4, 5];
const projection = createSwitchableProjection({ items: source, offset: 1, limit: 3, enabled: false }, (value) =>
	publications.push(value),
);
source[1] = 99;
projection.start();
assert.deepEqual(publications, [[]]);
projection.setItems([10, 20, 30, 40]);
projection.setWindow(1, 2);
await flushMicrotasks();
assert.deepEqual(publications, [[]]);
projection.setEnabled(true);
await flushMicrotasks();
assert.deepEqual(publications.at(-1), [20, 60]);

const beforeInvalidSetter = projection.snapshot();
assert.throws(() => projection.setItems([1, Number.NaN]), TypeError);
assert.throws(() => projection.setItems(null), TypeError);
assert.throws(() => projection.setWindow(-1, 2), TypeError);
assert.deepEqual(projection.snapshot(), beforeInvalidSetter);
const publicationCount = publications.length;
projection.setEnabled(true);
projection.setWindow(1, 2);
projection.setItems([10, 20, 30, 40]);
await flushMicrotasks();
assert.equal(publications.length, publicationCount);
publications.at(-1)[0] = -1;
assert.deepEqual(projection.snapshot(), [20, 60]);

projection.setItems([2, 4, 6]);
projection.stop();
projection.start();
assert.deepEqual(publications.at(-1), [4, 12]);
const afterRestart = publications.length;
await flushMicrotasks();
assert.equal(publications.length, afterRestart);

for (let seed = 0; seed < 12; ++seed) {
	const items = Array.from({ length: 8 }, (_, index) => seed - index / 2);
	const offset = seed % 5;
	const limit = seed % 4;
	projection.setItems(items);
	projection.setWindow(offset, limit);
	await flushMicrotasks();
	assert.deepEqual(
		projection.snapshot(),
		items.slice(offset, offset + limit).map((value, index) => value * (index + 1)),
	);
}

projection.setItems([100]);
projection.dispose();
projection.dispose();
await flushMicrotasks();
const disposedCount = publications.length;
projection.start();
projection.setItems([200]);
await flushMicrotasks();
assert.equal(publications.length, disposedCount);
assert.deepEqual(projection.snapshot(), []);
