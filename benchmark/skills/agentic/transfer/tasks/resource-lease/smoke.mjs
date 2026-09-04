import { asyncDispose, dispose } from "@serve-tools/ponyfill-resource-management";
import { assert, loadSolution } from "../_shared.mjs";

const { openResourceLease } = await loadSolution();
const events = [];
const lease = await openResourceLease((registrar) => {
	registrar.use({ [dispose]: () => events.push("sync") });
	registrar.adopt("adopted", async (value) => events.push(value));
	registrar.use({ [asyncDispose]: async () => events.push("async") });
	registrar.defer(() => events.push("defer"));
	return 7;
});

assert.equal(lease.value, 7);
assert.deepEqual(events, []);
let settled = false;
lease.closed.finally(() => void (settled = true));
await Promise.resolve();
assert.equal(settled, false);
assert.equal(lease.close(), lease.closed);
assert.equal(lease.close(), lease.closed);
await lease.closed;
assert.deepEqual(events, ["defer", "async", "adopted", "sync"]);
assert.equal(settled, true);
