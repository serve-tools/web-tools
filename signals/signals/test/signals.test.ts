import { Signal as DirectSignal } from "@serve-tools/signal";
import {
	SignalArray as DirectSignalArray,
	SignalMap as DirectSignalMap,
	SignalObject as DirectSignalObject,
	SignalSet as DirectSignalSet,
} from "@serve-tools/signal-collections";
import { createEffect as directCreateEffect, effect as directEffect } from "@serve-tools/signal-effect";
import { expect, test } from "vitest";
import { createEffect, effect, Signal, SignalArray, SignalMap, SignalObject, SignalSet } from "../src/signals.js";

test("preserves the owning packages' runtime exports", () => {
	expect(Signal).toBe(DirectSignal);
	expect(SignalArray).toBe(DirectSignalArray);
	expect(SignalMap).toBe(DirectSignalMap);
	expect(SignalObject).toBe(DirectSignalObject);
	expect(SignalSet).toBe(DirectSignalSet);
	expect(createEffect).toBe(directCreateEffect);
	expect(effect).toBe(directEffect);
});
