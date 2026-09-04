import { SignalArray, SignalObject } from "@serve-tools/signal-collections";
import { createEffect } from "@serve-tools/signal-effect";

interface InitialProjection {
	readonly items: Iterable<number>;
	readonly limit: number;
	readonly enabled: boolean;
}

export function createDeferredProjection(initial: InitialProjection, publish: (value: number[]) => void) {
	if (typeof publish !== "function") {
		throw new TypeError("Expected publish");
	}

	const initialItems = copyItems(initial?.items);

	validateLimit(initial?.limit);
	validateEnabled(initial?.enabled);

	const items = new SignalArray(initialItems);
	const settings = new SignalObject({ limit: initial.limit, enabled: initial.enabled });
	const snapshot = (): number[] =>
		settings.enabled ? items.slice(0, settings.limit).map((value) => value ** 2) : [];
	const observer = createEffect(() => publish(snapshot()));

	return {
		setItems(value: Iterable<number>): void {
			const next = copyItems(value);

			if (next.length === items.length && next.every((item, index) => Object.is(item, items[index]))) {
				return;
			}

			items.splice(0, items.length, ...next);
		},
		setLimit(value: number): void {
			validateLimit(value);
			settings.limit = value;
		},
		setEnabled(value: boolean): void {
			validateEnabled(value);
			settings.enabled = value;
		},
		start: () => observer.start(),
		snapshot,
		dispose: () => observer.dispose(),
	};
}

function copyItems(value: Iterable<number>): number[] {
	if (value == null || typeof value[Symbol.iterator] !== "function") {
		throw new TypeError("Expected iterable items");
	}

	const items = Array.from(value, (item) => {
		if (typeof item !== "number" || !Number.isFinite(item)) {
			throw new TypeError("Expected finite items");
		}

		return item;
	});

	return items;
}

function validateLimit(value: unknown): asserts value is number {
	if (!Number.isSafeInteger(value) || (value as number) < 0) {
		throw new TypeError("Invalid limit");
	}
}

function validateEnabled(value: unknown): asserts value is boolean {
	if (typeof value !== "boolean") {
		throw new TypeError("Invalid enabled state");
	}
}
