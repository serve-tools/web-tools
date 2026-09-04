import { assert, flushMicrotasks, loadSolution } from "../_shared.mjs";

const { createTagWindow } = await loadSolution();

const sparseInitial = ["ok"];
sparseInitial.length = 3;
sparseInitial[2] = "later";

for (const invalid of [null, 1, ["ok", ""], ["ok", 2], sparseInitial]) {
	let publications = 0;

	assert.throws(() => createTagWindow(invalid, () => ++publications), TypeError);
	assert.equal(publications, 0);
}
assert.throws(() => createTagWindow([], null), TypeError);

{
	const seen = [];
	let constructing = true;
	const window = createTagWindow(new Set(["a", "b", "c", "d"]), (snapshot) => {
		assert.equal(constructing, true);
		seen.push(snapshot);
	});

	constructing = false;
	assert.deepEqual(seen, [{ count: 4, tags: ["a", "b", "c"] }]);
	assert.deepEqual(Object.keys(seen[0]), ["count", "tags"]);

	const first = window.snapshot();
	const second = window.snapshot();

	assert.notEqual(first, second);
	assert.notEqual(first.tags, second.tags);
	assert.deepEqual(first, { count: 4, tags: ["a", "b", "c"] });
	first.count = 0;
	first.tags.splice(0);
	seen[0].tags.splice(0);
	assert.deepEqual(window.snapshot(), { count: 4, tags: ["a", "b", "c"] });
}

{
	const seen = [];
	const window = createTagWindow(["a", "b", "a", "c", "d"], (snapshot) => seen.push(snapshot));

	assert.equal(window.add("b"), false);
	assert.deepEqual(window.snapshot(), { count: 4, tags: ["a", "b", "c"] });
	assert.equal(window.delete("missing"), false);
	window.setLimit(3);
	await flushMicrotasks();
	assert.equal(seen.length, 1);

	assert.equal(window.delete("b"), true);
	assert.equal(window.add("b"), true);
	window.setLimit(4);
	window.setLimit(2);
	assert.deepEqual(window.snapshot(), { count: 4, tags: ["a", "c"] });
	assert.equal(seen.length, 1);
	await flushMicrotasks();
	assert.deepEqual(seen, [
		{ count: 4, tags: ["a", "b", "c"] },
		{ count: 4, tags: ["a", "c"] },
	]);
	assert.notEqual(seen[0], seen[1]);
	assert.notEqual(seen[0].tags, seen[1].tags);

	window.setLimit(0);
	await flushMicrotasks();
	assert.deepEqual(window.snapshot(), { count: 4, tags: [] });
}

{
	const seen = [];
	const window = createTagWindow([], (snapshot) => seen.push(snapshot));

	for (const invalid of ["", 1, null, {}]) {
		assert.throws(() => window.add(invalid), TypeError);
		assert.throws(() => window.delete(invalid), TypeError);
	}
	for (const invalid of [-1, 1.5, Infinity, Number.MAX_SAFE_INTEGER + 1, "2", null]) {
		assert.throws(() => window.setLimit(invalid), TypeError);
	}
	assert.deepEqual(window.snapshot(), { count: 0, tags: [] });
	await flushMicrotasks();
	assert.equal(seen.length, 1);

	window.setLimit(Number.MAX_SAFE_INTEGER);
	window.add("x");
	window.dispose();
	window.dispose();
	await flushMicrotasks();
	assert.deepEqual(seen, [{ count: 0, tags: [] }]);
	assert.deepEqual(window.snapshot(), { count: 1, tags: ["x"] });

	assert.equal(window.delete("x"), true);
	assert.equal(window.add("y"), true);
	window.setLimit(1);
	await flushMicrotasks();
	assert.equal(seen.length, 1);
	assert.deepEqual(window.snapshot(), { count: 1, tags: ["y"] });
}
