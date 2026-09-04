import { Observable } from "@serve-tools/ponyfill-observable";
import { assert, loadSolution } from "../_shared.mjs";

const originalSubscribe = Observable.prototype.subscribe;
let subscriptions = 0;

Observable.prototype.subscribe = function (...arguments_) {
	++subscriptions;

	return originalSubscribe.apply(this, arguments_);
};

try {
	const { watchUntilAborted } = await loadSolution();
	const target = new EventTarget();
	const remove = target.removeEventListener.bind(target);
	let removals = 0;

	target.removeEventListener = (...arguments_) => {
		++removals;

		return remove(...arguments_);
	};

	const external = new AbortController();
	const stopped = watchUntilAborted(target, new AbortController().signal);
	const aborted = watchUntilAborted(target, external.signal);

	for (const detail of [1, "2"]) {
		target.dispatchEvent(new CustomEvent("note", { detail }));
	}

	stopped.stop();
	stopped.stop();
	external.abort("done");
	target.dispatchEvent(new CustomEvent("note", { detail: "late" }));

	assert.deepEqual(stopped.seen, ["1", "2"]);
	assert.deepEqual(aborted.seen, ["1", "2"]);
	assert.equal(removals, 2);
	assert.equal(subscriptions, 2);

	const preAborted = new AbortController();

	preAborted.abort();

	const inactive = watchUntilAborted(target, preAborted.signal);

	target.dispatchEvent(new CustomEvent("note", { detail: "never" }));
	assert.deepEqual(inactive.seen, []);
	assert.equal(subscriptions, 3);
	assert.throws(() => watchUntilAborted({}, new AbortController().signal), TypeError);
	assert.throws(() => watchUntilAborted(target, {}), TypeError);
} finally {
	Observable.prototype.subscribe = originalSubscribe;
}
