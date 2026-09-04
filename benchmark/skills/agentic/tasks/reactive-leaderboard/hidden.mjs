import { assert, flushMicrotasks, loadSolution } from "../_shared.mjs";

const { createReactiveLeaderboard } = await loadSolution();
const published = [];
const board = createReactiveLeaderboard([["a", 1]], (value) => published.push(value));

board.setScore("a", 1);
board.remove("missing");
await flushMicrotasks();
assert.equal(published.length, 1, "no-op mutations must not publish");

const first = board.snapshot();
first[0].score = 999;
first.push({ id: "fake", score: 100 });
assert.deepEqual(board.snapshot(), [{ id: "a", score: 1 }]);

board.setScore("b", 2);
board.dispose();
board.dispose();
await flushMicrotasks();
assert.equal(published.length, 1, "disposal must cancel queued publication");
assert.deepEqual(board.snapshot(), [
	{ id: "b", score: 2 },
	{ id: "a", score: 1 },
]);

board.setScore("c", 3);
await flushMicrotasks();
assert.equal(published.length, 1);
assert.throws(() => board.setScore("d", Number.NaN), TypeError);
assert.throws(() => board.remove(1), TypeError);
