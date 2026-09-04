import { asyncDispose, dispose } from "@serve-tools/ponyfill-resource-management";
import { assert, loadSolution } from "../_shared.mjs";

const { runResourceScope } = await loadSolution();
assert.equal(typeof runResourceScope, "function");

const events = [];
const result = await runResourceScope(
	(registrar) => {
		registrar.use({ [dispose]: () => events.push("sync") });
		registrar.adopt("adopted", async (value) => events.push(value));
		registrar.use({ [asyncDispose]: async () => events.push("async") });
		registrar.defer(() => events.push("defer"));
		return 4;
	},
	async (value) => {
		events.push(`work:${value}`);
		return value * 2;
	},
);

assert.equal(result, 8);
assert.deepEqual(events, ["work:4", "defer", "async", "adopted", "sync"]);
