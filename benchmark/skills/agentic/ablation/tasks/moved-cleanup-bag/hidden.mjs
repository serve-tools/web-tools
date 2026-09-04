import { assert, loadSolution } from "../_shared.mjs";

const { createCleanupBag } = await loadSolution();

{
	const events = [];
	const bag = createCleanupBag();

	bag.defer(() => events.push("first"));
	assert.throws(() => bag.defer(null), TypeError);
	bag.defer(() => events.push("last"));
	bag.dispose();
	bag.dispose();

	assert.deepEqual(events, ["last", "first"]);
	assert.throws(() => bag.defer(() => {}), ReferenceError);
	assert.throws(() => bag.move(), ReferenceError);
}

{
	const events = [];
	const oldOwner = createCleanupBag();

	oldOwner.defer(() => events.push("old-1"));
	oldOwner.defer(() => events.push("old-2"));

	const nextOwner = oldOwner.move();

	assert.notEqual(nextOwner, oldOwner);
	assert.throws(() => oldOwner.defer(() => events.push("wrong")), ReferenceError);
	assert.throws(() => oldOwner.move(), ReferenceError);
	oldOwner.dispose();
	assert.deepEqual(events, []);

	nextOwner.defer(() => events.push("new"));
	const finalOwner = nextOwner.move();

	assert.notEqual(finalOwner, nextOwner);
	assert.throws(() => nextOwner.defer(() => events.push("wrong")), ReferenceError);
	nextOwner.dispose();
	assert.deepEqual(events, []);

	finalOwner.dispose();
	oldOwner.dispose();
	nextOwner.dispose();
	finalOwner.dispose();
	assert.deepEqual(events, ["new", "old-2", "old-1"]);
}

{
	const failure = { source: "cleanup" };
	const events = [];
	const bag = createCleanupBag();

	bag.defer(() => events.push("first"));
	bag.defer(() => {
		events.push("failure");
		throw failure;
	});
	bag.defer(() => events.push("last"));

	assert.throws(
		() => bag.dispose(),
		(error) => error === failure,
	);
	assert.deepEqual(events, ["last", "failure", "first"]);
	bag.dispose();
	assert.deepEqual(events, ["last", "failure", "first"]);
}
