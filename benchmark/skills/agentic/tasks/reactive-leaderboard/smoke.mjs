import { assert, flushMicrotasks, loadSolution } from "../_shared.mjs";

const { createReactiveLeaderboard } = await loadSolution();
assert.equal(typeof createReactiveLeaderboard, "function");

const published = [];
const board = createReactiveLeaderboard(
	[
		["bea", 5],
		["ada", 5],
	],
	(value) => published.push(value),
);

assert.deepEqual(published, [
	[
		{ id: "ada", score: 5 },
		{ id: "bea", score: 5 },
	],
]);
board.setScore("cy", 8);
board.setScore("ada", 7);
board.remove("missing");
assert.equal(published.length, 1);
await flushMicrotasks();
assert.deepEqual(published.at(-1), [
	{ id: "cy", score: 8 },
	{ id: "ada", score: 7 },
	{ id: "bea", score: 5 },
]);
board.dispose();
