import { expect, test } from "vitest";

import { benchmark } from "../../benchmark.js";
import { settle } from "../src/lib/.result.js";

test("interaction settlement hot path", async () => {
	const platformPromise = Promise.resolve(1);

	await benchmark(
		"client-interaction/settle-completed-promise",
		async () => {
			await settle(platformPromise);
		},
		{ iterations: 10_000 },
	);

	await expect(settle(platformPromise)).resolves.toEqual({ status: "completed", value: 1 });
});
