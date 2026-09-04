import { SignalArray, SignalObject } from "@serve-tools/signal-collections";
import type { Effect } from "@serve-tools/signal-effect";
import { createEffect } from "@serve-tools/signal-effect";

interface ProjectionInput {
	readonly items: Iterable<number>;
	readonly offset: number;
	readonly limit: number;
	readonly enabled: boolean;
}

export function createSwitchableProjection(initial: ProjectionInput, publish: (value: number[]) => void) {
	if (typeof publish !== "function") {
		throw new TypeError("Expected publish callback");
	}

	const initialItems = copyItems(initial?.items);

	validateWindow(initial?.offset, initial?.limit);
	validateEnabled(initial?.enabled);

	const items = new SignalArray(initialItems);
	const settings = new SignalObject({ offset: initial.offset, limit: initial.limit, enabled: initial.enabled });
	const snapshot = (): number[] =>
		settings.enabled
			? items.slice(settings.offset, settings.offset + settings.limit).map((value, index) => value * (index + 1))
			: [];

	let active: Effect | undefined;
	let disposed = false;

	return {
		setItems(value: Iterable<number>): void {
			const next = copyItems(value);

			if (next.length === items.length && next.every((item, index) => Object.is(item, items[index]))) {
				return;
			}

			items.splice(0, items.length, ...next);
		},
		setWindow(offset: number, limit: number): void {
			validateWindow(offset, limit);
			settings.offset = offset;
			settings.limit = limit;
		},
		setEnabled(value: boolean): void {
			validateEnabled(value);
			settings.enabled = value;
		},
		start(): void {
			if (disposed || active) {
				return;
			}

			active = createEffect(() => publish(snapshot()));
			active.start();
		},
		stop(): void {
			active?.dispose();
			active = undefined;
		},
		snapshot,
		dispose(): void {
			if (disposed) {
				return;
			}

			disposed = true;
			active?.dispose();
			active = undefined;
		},
	};
}

function copyItems(value: Iterable<number>): number[] {
	if (value == null || typeof value[Symbol.iterator] !== "function") {
		throw new TypeError("Expected iterable items");
	}

	return Array.from(value, (item) => {
		if (typeof item !== "number" || !Number.isFinite(item)) {
			throw new TypeError("Expected finite items");
		}

		return item;
	});
}

function validateWindow(offset: unknown, limit: unknown): asserts offset is number {
	if (
		!Number.isSafeInteger(offset) ||
		(offset as number) < 0 ||
		!Number.isSafeInteger(limit) ||
		(limit as number) < 0
	) {
		throw new TypeError("Invalid window");
	}
}

function validateEnabled(value: unknown): asserts value is boolean {
	if (typeof value !== "boolean") {
		throw new TypeError("Invalid enabled state");
	}
}
