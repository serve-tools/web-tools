import { Signal } from "@serve-tools/signal";

/** Observes a derived signal once per microtask until disposed. */
export function effect<Value>(source: Signal.Computed<Value>, receive: (value: Value) => void): () => void {
	let queued = false;
	let active = true;
	const watcher = new Signal.subtle.Watcher(() => {
		if (!queued && active) {
			queued = true;
			queueMicrotask(run);
		}
	});
	const run = (): void => {
		queued = false;
		if (active) {
			receive(source.get());
			watcher.watch(source);
		}
	};

	run();
	return () => {
		active = false;
		watcher.unwatch(source);
	};
}
