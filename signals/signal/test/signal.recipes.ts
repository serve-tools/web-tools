import { Signal } from "../src/signal.js";

const first = new Signal.State("Ada");
const last = new Signal.State("Lovelace");
const fullName = new Signal.Computed(() => `${first.get()} ${last.get()}`);
const watcher = new Signal.subtle.Watcher(() => {
	for (const pending of watcher.getPending()) pending.get();

	watcher.watch();
});

watcher.watch(fullName);
last.set("Byron");
console.log(fullName.get());
watcher.unwatch(fullName);
