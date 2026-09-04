import { Observable } from "@serve-tools/ponyfill-observable";
import { assert, loadSolution } from "../_shared.mjs";

const originalToArray = Observable.prototype.toArray;
const consumed = [];

Observable.prototype.toArray = function (...arguments_) {
	consumed.push(this);

	return originalToArray.apply(this, arguments_);
};

try {
	const { collectReceipts } = await loadSolution();
	let run = 10;
	const events = [];
	const result = await collectReceipts(
		() => {
			const current = ++run;

			events.push(`start:${current}`);

			return current;
		},
		(current) => events.push(`cleanup:${current}`),
	);

	assert.deepEqual(result, [
		[22, 24],
		[24, 26],
	]);
	assert.deepEqual(events, ["start:11", "cleanup:11", "start:12", "cleanup:12"]);
	assert.equal(consumed.length, 2);
	assert.equal(consumed[0], consumed[1]);
	await assert.rejects(
		collectReceipts(null, () => {}),
		TypeError,
	);
	await assert.rejects(
		collectReceipts(() => 1, null),
		TypeError,
	);
} finally {
	Observable.prototype.toArray = originalToArray;
}
