import { assert, flushMicrotasks, loadSolution } from "../_shared.mjs";

const { createThresholdNotifier } = await loadSolution();

for (const [initial, threshold, publish] of [
	[NaN, 0, () => {}],
	[Infinity, 0, () => {}],
	[-Infinity, 0, () => {}],
	[0, Infinity, () => {}],
	[0, -Infinity, () => {}],
	[0, 0, null],
]) {
	let publications = 0;
	const callback = publish === null ? publish : () => ++publications;

	assert.throws(() => createThresholdNotifier(initial, threshold, callback), TypeError);
	assert.equal(publications, 0);
}

{
	const seen = [];
	let constructing = true;
	const notifier = createThresholdNotifier(5, 5, (snapshot) => {
		assert.equal(constructing, true);
		seen.push(snapshot);
	});

	constructing = false;
	assert.deepEqual(seen, [{ value: 5, above: true }]);
	assert.deepEqual(Object.keys(seen[0]), ["value", "above"]);

	const first = notifier.snapshot();
	const second = notifier.snapshot();

	assert.notEqual(first, second);
	assert.deepEqual(first, { value: 5, above: true });
	first.value = -100;
	first.above = false;
	seen[0].value = -200;
	assert.deepEqual(notifier.snapshot(), { value: 5, above: true });
}

{
	const seen = [];
	const notifier = createThresholdNotifier(0, 2, (snapshot) => seen.push(snapshot));

	notifier.set(1);
	assert.deepEqual(notifier.snapshot(), { value: 1, above: false });
	notifier.set(2);
	notifier.set(4);
	notifier.set(4);
	assert.equal(seen.length, 1);
	await flushMicrotasks();
	assert.deepEqual(seen, [
		{ value: 0, above: false },
		{ value: 4, above: true },
	]);
	assert.notEqual(seen[0], seen[1]);

	notifier.set(4);
	await flushMicrotasks();
	assert.equal(seen.length, 2);

	for (const invalid of [NaN, Infinity, -Infinity, "5", null]) {
		assert.throws(() => notifier.set(invalid), TypeError);
	}
	assert.deepEqual(notifier.snapshot(), { value: 4, above: true });
	await flushMicrotasks();
	assert.equal(seen.length, 2);
}

{
	const seen = [];
	const notifier = createThresholdNotifier(0, 0, (snapshot) => seen.push(snapshot));

	notifier.set(-0);
	assert.equal(Object.is(notifier.snapshot().value, -0), true);
	await flushMicrotasks();
	assert.equal(seen.length, 2);
	assert.equal(Object.is(seen[1].value, -0), true);
}

{
	const seen = [];
	const notifier = createThresholdNotifier(0, 1, (snapshot) => seen.push(snapshot));

	notifier.set(2);
	assert.deepEqual(notifier.snapshot(), { value: 2, above: true });
	notifier.dispose();
	notifier.dispose();
	await flushMicrotasks();
	assert.deepEqual(seen, [{ value: 0, above: false }]);

	notifier.set(-1);
	assert.deepEqual(notifier.snapshot(), { value: -1, above: false });
	await flushMicrotasks();
	assert.equal(seen.length, 1);
	assert.throws(() => notifier.set(NaN), TypeError);
}
