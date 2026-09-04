import { assert, loadSolution } from "../_shared.mjs";

const keepAlive = setInterval(() => {}, 50);

try {
	const { runPromotedOrder } = await loadSolution();
	const result = await runPromotedOrder();

	assert.deepEqual([...result].sort(), ["controlled", "visible"]);
} finally {
	clearInterval(keepAlive);
}
