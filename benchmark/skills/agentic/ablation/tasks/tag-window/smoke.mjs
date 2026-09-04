import { assert, flushMicrotasks, loadSolution } from "../_shared.mjs";

const { createTagWindow } = await loadSolution();
const seen = [];
const window = createTagWindow(["a", "b", "a", "c"], (snapshot) => seen.push(snapshot));

assert.deepEqual(window.snapshot(), { count: 3, tags: ["a", "b", "c"] });
window.setLimit(2);
await flushMicrotasks();
assert.deepEqual(window.snapshot(), { count: 3, tags: ["a", "b"] });
