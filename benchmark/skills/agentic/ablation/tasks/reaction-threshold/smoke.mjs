import { assert, flushMicrotasks, loadSolution } from "../_shared.mjs";

const { createThresholdNotifier } = await loadSolution();
const seen = [];
const notifier = createThresholdNotifier(2, 3, (snapshot) => seen.push(snapshot));

assert.deepEqual(seen, [{ value: 2, above: false }]);
notifier.set(3);
await flushMicrotasks();
assert.deepEqual(notifier.snapshot(), { value: 3, above: true });
