import { assert, loadSolution } from "../_shared.mjs";

const { createCleanupBag } = await loadSolution();
const events = [];
const bag = createCleanupBag();

bag.defer(() => events.push(1));
bag.defer(() => events.push(2));
bag.dispose();
bag.dispose();

assert.deepEqual(events, [2, 1]);
