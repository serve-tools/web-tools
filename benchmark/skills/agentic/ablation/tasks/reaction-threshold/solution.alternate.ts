import { Signal } from "@serve-tools/signal";
import { effect } from "@serve-tools/signal-effect";

export function createThresholdNotifier(
	initial: number,
	threshold: number,
	publish: (snapshot: { value: number; above: boolean }) => void,
) {
	if (!Number.isFinite(initial) || !Number.isFinite(threshold) || typeof publish !== "function") {
		throw new TypeError("Invalid input");
	}
	const value = new Signal.State(initial);
	const above = new Signal.Computed(() => value.get() >= threshold);
	let disposed = false;
	const stop = effect(() => {
		const snapshot = { value: value.get(), above: above.get() };
		if (!disposed) {
			publish(snapshot);
		}
	});
	return {
		set(next: number): void {
			if (!Number.isFinite(next)) {
				throw new TypeError("Expected a finite number");
			}
			value.set(next);
		},
		snapshot: (): { value: number; above: boolean } => ({ value: value.get(), above: above.get() }),
		dispose(): void {
			if (!disposed) {
				disposed = true;
				stop();
			}
		},
	};
}
