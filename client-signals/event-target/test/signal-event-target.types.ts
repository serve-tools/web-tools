/// <reference lib="esnext.disposable" />

import type { EventTargetSignalOptions } from "../src/signal-event-target.js";
import { EventTargetSignal, MatchMediaSignal } from "../src/signal-event-target.js";

const target = new EventTarget();
const options = { signal: new AbortController().signal } satisfies EventTargetSignalOptions<number>;
const value = new EventTargetSignal(target, "change", () => 1, options);
const media = new MatchMediaSignal("(prefers-color-scheme: dark)");

const currentValue: number = value.get();
const currentMatch: boolean = media.get();
const exactQuery: "(prefers-color-scheme: dark)" = media.query;
const mediaTarget: MediaQueryList = media.target;

// @ts-expect-error event-target-backed Signals are read-only
value.set(2);
// @ts-expect-error MatchMediaSignal values are read-only
media.set(true);

value.refresh();
value.dispose();
media.dispose();
void currentValue;
void currentMatch;
void exactQuery;
void mediaTarget;
