import { assert, loadSolution } from "../_shared.mjs";

const { inspectRequestTarget } = await loadSolution();

assert.deepEqual(inspectRequestTarget("/releases/beta?page=2&label=x&label=y"), {
	channel: "beta",
	page: 2,
	labels: ["x", "y"],
});
