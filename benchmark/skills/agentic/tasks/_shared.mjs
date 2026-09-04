import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";

export { assert };

export async function loadSolution() {
	const path = process.argv[2];

	assert.equal(typeof path, "string", "expected an emitted solution path as argv[2]");

	return import(pathToFileURL(path).href);
}

export const flushMicrotasks = async (count = 2) => {
	for (let index = 0; index < count; ++index) {
		await Promise.resolve();
	}
};

export async function waitFor(predicate, milliseconds = 500) {
	const deadline = performance.now() + milliseconds;

	while (!predicate()) {
		if (performance.now() >= deadline) {
			throw new Error("condition timed out");
		}

		await new Promise((resolve) => setTimeout(resolve, 0));
	}
}

export async function rejectsWithin(value, check, milliseconds = 500) {
	let timer;

	try {
		await assert.rejects(
			Promise.race([
				Promise.resolve(value),
				new Promise((_, reject) => {
					timer = setTimeout(() => reject(new Error("operation timed out")), milliseconds);
				}),
			]),
			check,
		);
	} finally {
		clearTimeout(timer);
	}
}
