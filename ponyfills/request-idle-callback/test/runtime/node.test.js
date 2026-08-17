import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { createIdleCallbackScheduler } from "../../runtime/.scheduler.js";
import * as nodeRuntime from "../../runtime/node.js";
import { runConformance } from "./conformance.js";

describe("Node.js requestIdleCallback runtime", () => {
	it("satisfies the shared runtime contract", () => runConformance(nodeRuntime));

	it("backs off before starting work when the runtime is busy", () => {
		const deferred = [];
		const postponed = [];
		const deadlines = [];
		let isIdle = false;

		const { requestIdleCallback } = createIdleCallbackScheduler({
			now: () => 0,
			defer: (callback) => deferred.push(callback),
			postpone: (callback) => postponed.push(callback),
			setTimer: () => 1,
			clearTimer: () => {},
			shouldStart: () => isIdle,
		});

		requestIdleCallback((deadline) => deadlines.push(deadline));

		deferred.shift()();

		assert.equal(deadlines.length, 0);
		assert.equal(postponed.length, 1);

		isIdle = true;
		postponed.shift()();

		assert.equal(deadlines.length, 1);
	});
});
