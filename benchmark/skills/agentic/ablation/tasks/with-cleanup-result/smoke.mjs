import { assert, loadSolution } from "../_shared.mjs";

const { withCleanup } = await loadSolution();
const events = [];
const value = { id: 3 };

assert.equal(
	await withCleanup(
		() => {
			events.push("work");

			return value;
		},
		() => events.push("cleanup"),
	),
	value,
);
assert.deepEqual(events, ["work", "cleanup"]);

await assert.rejects(
	Promise.resolve().then(() => withCleanup(null, () => {})),
	TypeError,
);
