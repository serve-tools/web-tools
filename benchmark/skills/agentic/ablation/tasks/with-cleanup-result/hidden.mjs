import { SuppressedError } from "@serve-tools/ponyfill-resource-management";
import { assert, flushMicrotasks, loadSolution } from "../_shared.mjs";

const { withCleanup } = await loadSolution();

const settle = async (callback) => {
	try {
		return { status: "fulfilled", value: await callback() };
	} catch (reason) {
		return { reason, status: "rejected" };
	}
};

{
	let workCalls = 0;
	const invalidCleanup = await settle(() =>
		withCleanup(() => {
			++workCalls;
		}, null),
	);

	assert.equal(invalidCleanup.status, "rejected");
	assert.equal(invalidCleanup.reason instanceof TypeError, true);
	assert.equal(workCalls, 0);

	for (const invalidWork of [null, 0, {}, "work"]) {
		const outcome = await settle(() => withCleanup(invalidWork, () => {}));

		assert.equal(outcome.status, "rejected");
		assert.equal(outcome.reason instanceof TypeError, true);
	}
}

{
	const events = [];
	const value = { answer: 42 };
	let releaseCleanup;
	let settled = false;
	const result = withCleanup(
		async () => {
			events.push("work");
			await Promise.resolve();

			return value;
		},
		() =>
			new Promise((resolve) => {
				events.push("cleanup");
				releaseCleanup = resolve;
			}),
	).then((returned) => {
		settled = true;

		return returned;
	});

	await flushMicrotasks();
	assert.deepEqual(events, ["work", "cleanup"]);
	assert.equal(settled, false);
	releaseCleanup();
	assert.equal(await result, value);
	assert.equal(settled, true);
}

for (const workFailure of [undefined, null, 0]) {
	let cleanupCalls = 0;
	const outcome = await settle(() =>
		withCleanup(
			() => Promise.reject(workFailure),
			async () => {
				++cleanupCalls;
			},
		),
	);

	assert.equal(outcome.status, "rejected");
	assert.equal(outcome.reason, workFailure);
	assert.equal(cleanupCalls, 1);
}

for (const cleanupFailure of [undefined, null, 0]) {
	const value = {};
	const outcome = await settle(() =>
		withCleanup(
			() => value,
			() => Promise.reject(cleanupFailure),
		),
	);

	assert.equal(outcome.status, "rejected");
	assert.equal(outcome.reason, cleanupFailure);
}

{
	const workFailure = { source: "work" };
	const cleanupFailure = { source: "cleanup" };
	let workCalls = 0;
	let cleanupCalls = 0;
	const outcome = await settle(() =>
		withCleanup(
			() => {
				++workCalls;
				throw workFailure;
			},
			() => {
				++cleanupCalls;
				throw cleanupFailure;
			},
		),
	);

	assert.equal(outcome.status, "rejected");
	assert.equal(outcome.reason instanceof SuppressedError, true);
	assert.equal(outcome.reason.error, cleanupFailure);
	assert.equal(outcome.reason.suppressed, workFailure);
	assert.equal(workCalls, 1);
	assert.equal(cleanupCalls, 1);
}
