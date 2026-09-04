import { assert, loadSolution } from "../_shared.mjs";

const { watchUntilAborted } = await loadSolution();
const target = new EventTarget();
const controller = new AbortController();
const watcher = watchUntilAborted(target, controller.signal);

target.dispatchEvent(new CustomEvent("note", { detail: "a" }));

assert.deepEqual(watcher.seen, ["a"]);
assert.equal(typeof watcher.stop, "function");

watcher.stop();
