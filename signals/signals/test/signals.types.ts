import type { Signal as DirectSignal } from "@serve-tools/signal";
import type { SignalArray as DirectSignalArray } from "@serve-tools/signal-collections";
import type { Effect as DirectEffect } from "@serve-tools/signal-effect";
import type { Effect, Signal, SignalArray } from "../src/signals.js";

const signal: typeof DirectSignal = null as unknown as typeof Signal;
const array: DirectSignalArray<string> = null as unknown as SignalArray<string>;
const effect: DirectEffect = null as unknown as Effect;

void signal;
void array;
void effect;
