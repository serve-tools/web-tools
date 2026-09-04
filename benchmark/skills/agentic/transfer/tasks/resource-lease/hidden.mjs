import { dispose, SuppressedError } from "@serve-tools/ponyfill-resource-management";
import { assert, loadSolution } from "../_shared.mjs";

const { openResourceLease } = await loadSolution();
await assert.rejects(openResourceLease(null), TypeError);

const rollbackEvents = [];
const acquisitionFailure = new Error("acquire");
await assert.rejects(
	openResourceLease((registrar) => {
		registrar.defer(async () => rollbackEvents.push("later"));
		registrar.use({ [dispose]: () => rollbackEvents.push("earlier") });
		throw acquisitionFailure;
	}),
	(reason) => reason === acquisitionFailure,
);
assert.deepEqual(rollbackEvents, ["earlier", "later"]);

let invalidCleaned = false;
await assert.rejects(
	openResourceLease((registrar) => {
		registrar.defer(() => void (invalidCleaned = true));
		registrar.use({ [Symbol.dispose]() {} });
	}),
	TypeError,
);
assert.equal(invalidCleaned, true);

let invalidCallbackCleaned = false;
await assert.rejects(
	openResourceLease((registrar) => {
		registrar.defer(() => void (invalidCallbackCleaned = true));
		registrar.defer(null);
	}),
	TypeError,
);
assert.equal(invalidCallbackCleaned, true);

const asyncAcquireEvents = [];
const asyncAcquireFailure = new Error("async acquire");
await assert.rejects(
	openResourceLease(async (registrar) => {
		registrar.defer(async () => {
			await Promise.resolve();
			asyncAcquireEvents.push("cleaned");
		});
		throw asyncAcquireFailure;
	}),
	(reason) => reason === asyncAcquireFailure,
);
assert.deepEqual(asyncAcquireEvents, ["cleaned"]);

const acquireError = new Error("acquire");
const laterError = new Error("later");
const earlierError = new Error("earlier");
let thrown;
try {
	await openResourceLease((registrar) => {
		registrar.defer(() => {
			throw earlierError;
		});
		registrar.defer(async () => {
			throw laterError;
		});
		throw acquireError;
	});
} catch (error) {
	thrown = error;
}
assert.equal(thrown instanceof SuppressedError, true);
assert.equal(thrown.error, earlierError);
assert.equal(thrown.suppressed instanceof SuppressedError, true);
assert.equal(thrown.suppressed.error, laterError);
assert.equal(thrown.suppressed.suppressed, acquireError);

let closeCount = 0;
const closeFailure = new Error("close");
const lease = await openResourceLease((registrar) => {
	registrar.defer(async () => {
		++closeCount;
		throw closeFailure;
	});
	return "value";
});
const first = lease.close();
const second = lease.close();
assert.equal(first, lease.closed);
assert.equal(second, lease.closed);
await assert.rejects(lease.closed, (reason) => reason === closeFailure);
assert.equal(closeCount, 1);

let packageDisposed = false;
const packageLease = await openResourceLease((registrar) =>
	registrar.use({ [dispose]: () => void (packageDisposed = true), [Symbol.dispose]: () => assert.fail("native") }),
);
await packageLease.close();
assert.equal(packageDisposed, true);
