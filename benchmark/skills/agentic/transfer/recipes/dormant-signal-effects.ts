import { Signal } from "@serve-tools/signal";
import type { Effect } from "@serve-tools/signal-effect";
import { createEffect } from "@serve-tools/signal-effect";

/** Defaults only omission and keeps an explicit disabled value distinct from invalid `null`. */
export const normalizeInitialEnabled = (value: unknown = undefined): boolean => {
	const enabled = value === undefined ? true : value;

	if (typeof enabled !== "boolean") {
		throw new TypeError("enabled must be a boolean");
	}

	return enabled;
};

export interface GatedEffect extends Effect {
	readonly enabled: boolean;
	setEnabled(value: unknown): void;
}

/** Creates an effect that stays dormant until start and publishes both enabled and disabled states. */
export const createGatedEffect = (
	run: () => void,
	onDisabled: () => void,
	initialEnabled: unknown = undefined,
): GatedEffect => {
	const enabled = new Signal.State(normalizeInitialEnabled(initialEnabled));
	const effect = createEffect(() => {
		if (enabled.get()) {
			run();
		} else {
			onDisabled();
		}
	});

	let disposed = false;

	return {
		get enabled() {
			return enabled.get();
		},
		start: effect.start,
		setEnabled(value) {
			const next = normalizeInitialEnabled(value);

			if (!disposed) {
				enabled.set(next);
			}
		},
		dispose() {
			if (disposed) {
				return;
			}

			disposed = true;
			effect.dispose();
		},
	};
};

// Add your task adapter below.
