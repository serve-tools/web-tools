import { EventTargetSignal, type EventTargetSignalOptions, MatchMediaSignal, watch } from "../src/lit-signals.js";

const options = { signal: new AbortController().signal } satisfies EventTargetSignalOptions<number>;
const value = new EventTargetSignal(new EventTarget(), "change", () => 1, options);
const media = new MatchMediaSignal("(prefers-color-scheme: dark)");

watch(value);
watch(media);

const currentValue: number = value.get();
const currentMatch: boolean = media.get();
const exactQuery: "(prefers-color-scheme: dark)" = media.query;

value.dispose();
media.dispose();
void currentValue;
void currentMatch;
void exactQuery;
