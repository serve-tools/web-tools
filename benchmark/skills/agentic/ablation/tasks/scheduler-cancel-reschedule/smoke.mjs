import { assert, loadSolution } from "../_shared.mjs";

const keepAlive = setInterval(() => {}, 50);

try {
	const { cancelThenReschedule } = await loadSolution();
	const result = await cancelThenReschedule({ public: true });

	assert.equal(result.ran.includes("replacement"), true);
} finally {
	clearInterval(keepAlive);
}
