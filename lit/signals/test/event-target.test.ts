import {
	EventTargetSignal as DirectEventTargetSignal,
	MatchMediaSignal as DirectMatchMediaSignal,
} from "@serve-tools/signal-event-target";
import { describe, expect, it } from "vitest";

import { EventTargetSignal, MatchMediaSignal } from "../src/lit-signals.js";

describe("event-target exports", () => {
	it("re-exports the compatible event-target Signal constructors", () => {
		expect(EventTargetSignal).toBe(DirectEventTargetSignal);
		expect(MatchMediaSignal).toBe(DirectMatchMediaSignal);
	});
});
