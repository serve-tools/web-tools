import { asyncDispose, dispose, SuppressedError } from "@serve-tools/ponyfill-resource-management";
import { assert, loadSolution } from "../_shared.mjs";

const { runResourceScope } = await loadSolution();

const events = [];
const acquisitionFailure = new Error("acquire");
await assert.rejects(
	runResourceScope(
		(registrar) => {
			registrar.defer(async () => events.push("cleaned"));
			throw acquisitionFailure;
		},
		() => {
			throw new Error("work must not run");
		},
	),
	(reason) => reason === acquisitionFailure,
);
assert.deepEqual(events, ["cleaned"]);

const workFailure = new Error("work");
const laterFailure = new Error("later registration");
const earlierFailure = new Error("earlier registration");
let thrown;

try {
	await runResourceScope(
		(registrar) => {
			registrar.defer(() => {
				throw earlierFailure;
			});
			registrar.defer(async () => {
				throw laterFailure;
			});
		},
		() => {
			throw workFailure;
		},
	);
} catch (error) {
	thrown = error;
}

assert.equal(thrown instanceof SuppressedError, true);
assert.equal(thrown.error, earlierFailure);
assert.equal(thrown.suppressed instanceof SuppressedError, true);
assert.equal(thrown.suppressed.error, laterFailure);
assert.equal(thrown.suppressed.suppressed, workFailure);

await assert.rejects(
	runResourceScope(
		(registrar) => registrar.use({ [Symbol.dispose]() {} }),
		() => undefined,
	),
	TypeError,
);

let packageDisposed = false;
await runResourceScope(
	(registrar) => registrar.use({ [dispose]: () => void (packageDisposed = true), [asyncDispose]: undefined }),
	() => undefined,
);
assert.equal(packageDisposed, true);
