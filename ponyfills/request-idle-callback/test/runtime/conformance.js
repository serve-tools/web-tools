import assert from "node:assert/strict";

const waitFor = async (condition) => {
	for (let attempt = 0; attempt < 100; ++attempt) {
		if (condition()) {
			return;
		}

		await new Promise((resolve) => setTimeout(resolve, 1));
	}

	assert.fail("Timed out waiting for an idle callback");
};

/** Runs the runtime-neutral idle-callback conformance checks. */
export async function runConformance({ cancelIdleCallback, requestIdleCallback }) {
	{
		const deadlines = [];
		const handle = requestIdleCallback((deadline) => deadlines.push(deadline));

		assert.equal(typeof handle, "number");

		await waitFor(() => deadlines.length === 1);

		assert.equal(deadlines[0].didTimeout, false);
		assert.ok(deadlines[0].timeRemaining() >= 0);
		assert.ok(deadlines[0].timeRemaining() <= 8);
	}

	{
		const order = [];

		requestIdleCallback(() => {
			order.push(1);
			requestIdleCallback(() => order.push(3));
		});
		requestIdleCallback(() => order.push(2));

		await waitFor(() => order.length === 3);

		assert.deepEqual(order, [1, 2, 3]);
	}

	{
		let called = false;
		const handle = requestIdleCallback(() => {
			called = true;
		});

		cancelIdleCallback(handle);
		await new Promise((resolve) => setTimeout(resolve, 10));

		assert.equal(called, false);
	}

	{
		const deadlines = [];

		requestIdleCallback(() => {
			const end = performance.now() + 10;

			while (performance.now() < end) {
				Math.random();
			}
		});
		requestIdleCallback((deadline) => deadlines.push(deadline), { timeout: 1 });

		await waitFor(() => deadlines.length === 1);

		assert.equal(deadlines[0].didTimeout, true);
		assert.equal(deadlines[0].timeRemaining(), 0);
	}
}
