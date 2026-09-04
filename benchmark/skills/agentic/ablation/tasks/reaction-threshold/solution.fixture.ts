import { Signal } from "@serve-tools/signal";
import { effect } from "@serve-tools/signal-effect";
export function createThresholdNotifier(
	initial: number,
	threshold: number,
	publish: (value: { value: number; above: boolean }) => void,
) {
	if (!Number.isFinite(initial) || !Number.isFinite(threshold) || typeof publish !== "function") {
		throw new TypeError("invalid input");
	}
	const value = new Signal.State(initial);
	const above = new Signal.Computed(() => value.get() >= threshold);
	const stop = effect(() => publish({ value: value.get(), above: above.get() }));
	return {
		set(next: number) {
			if (!Number.isFinite(next)) {
				throw new TypeError("value");
			}
			if (!Object.is(value.get(), next)) {
				value.set(next);
			}
		},
		snapshot: () => ({ value: value.get(), above: above.get() }),
		dispose: stop,
	};
}
