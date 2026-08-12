import { Signal } from "@serve-tools/signal";
import { html } from "lit";
import { type WatchCallback, type WatchSource, watch } from "../src/lit-signals.js";

const count = new Signal.State(1);
const doubled = new Signal.Computed(() => count.get() * 2);

html`${watch(count)} ${watch(doubled)}`;
html`${watch(() => count.get())}`;
html`${watch(() => html`${count.get()}`)}`;

const callback: WatchCallback<number> = () => count.get();
const source: WatchSource<number> = Math.random() > 0.5 ? count : callback;

html`${watch(source)}`;

// @ts-expect-error A plain value is not a signal.
watch(1);

// @ts-expect-error A reactive callback receives no arguments.
watch((value: number) => value);
