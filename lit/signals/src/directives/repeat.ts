import { Signal } from "@serve-tools/signal";
import type { DirectiveResult } from "lit/directive.js";
import { directive } from "lit/directive.js";
import { repeat as litRepeat } from "lit/directives/repeat.js";
import type { ReactiveSource } from "./.internals.js";
import { ReactiveDirective, readSource } from "./.internals.js";

/** Returns the stable identity of an item in a repeated reactive collection. */
export type RepeatKey<Value> = (value: Value, index: number) => unknown;

/** Renders one item in a repeated reactive collection. */
export type RepeatItem<Value, Result> = (value: Value, index: number) => Result;

class RepeatSignalDirective<Value = unknown, Result = unknown> extends ReactiveDirective<unknown> {
	#key: RepeatKey<Value> | undefined;
	#rows = new Map<unknown, RepeatRow<Value, Result>>();
	#template: RepeatItem<Value, Result> | undefined;

	render(
		source: ReactiveSource<Iterable<Value>>,
		keyOrTemplate: RepeatKey<Value> | RepeatItem<Value, Result>,
		template?: RepeatItem<Value, Result>,
	): unknown {
		const key = template === undefined ? undefined : (keyOrTemplate as RepeatKey<Value>);
		const renderItem = template ?? (keyOrTemplate as RepeatItem<Value, Result>);

		if (key !== this.#key || renderItem !== this.#template) {
			this.#key = key;
			this.#template = renderItem;

			for (const row of this.#rows.values()) {
				row.dispose?.();
			}

			this.#rows.clear();
		}

		const entries: RepeatEntry<Value, Result>[] = [];
		const retained = new Set<unknown>();

		let index = 0;

		for (const value of readSource(source)) {
			const rowKey = key === undefined ? index : key(value, index);
			let row = this.#rows.get(rowKey);

			if (row === undefined) {
				row = this.#createRow(value, index, renderItem);

				this.#rows.set(rowKey, row);
			} else if (!Object.is(row.value, value) || row.index !== index) {
				row.value = value;
				row.index = index;
				row.computed = new Signal.Computed(() => renderItem(row!.value, row!.index));
			}

			entries.push({ key: rowKey, row });
			retained.add(rowKey);

			++index;
		}

		for (const [rowKey, row] of this.#rows) {
			if (!retained.has(rowKey)) {
				row.dispose?.();
				this.#rows.delete(rowKey);
			}
		}

		return litRepeat(
			entries,
			(entry) => entry.key,
			(entry) => renderRepeatRow(entry.row),
		);
	}

	update(
		_part: unknown,
		args: [
			ReactiveSource<Iterable<Value>>,
			RepeatKey<Value> | RepeatItem<Value, Result>,
			RepeatItem<Value, Result> | undefined,
		],
	): unknown {
		return this.observeArguments(args, () => this.render(...args));
	}

	#createRow(value: Value, index: number, template: RepeatItem<Value, Result>): RepeatRow<Value, Result> {
		const row = { value, index } as RepeatRow<Value, Result>;

		row.computed = new Signal.Computed(() => template(row.value, row.index));

		return row;
	}
}

class RepeatRowDirective<Value = unknown> extends ReactiveDirective<Value> {
	#computed: Signal.Computed<Value> | undefined;
	#row: RepeatRow<unknown, Value> | undefined;

	readonly #dispose = (): void => {
		this.observe(undefined);
	};

	render(row: RepeatRow<unknown, Value>): Value {
		return Signal.subtle.untrack(() => row.computed.get());
	}

	update(_part: unknown, [row]: [RepeatRow<unknown, Value>]): Value {
		if (row !== this.#row) {
			if (this.#row?.dispose === this.#dispose) {
				this.#row.dispose = undefined;
			}

			this.#row = row;

			row.dispose = this.#dispose;
		}

		if (row.computed !== this.#computed) {
			this.#computed = row.computed;

			return this.observe(row.computed);
		}

		return this.read();
	}
}

const renderRepeatRow = directive(RepeatRowDirective);

/** Reconciles a reactive iterable by key and independently tracks every rendered item. */
export const repeat = directive(RepeatSignalDirective) as {
	<Value, Result>(
		source: ReactiveSource<Iterable<Value>>,
		template: RepeatItem<Value, Result>,
	): DirectiveResult<typeof RepeatSignalDirective<Value, Result>>;
	<Value, Result>(
		source: ReactiveSource<Iterable<Value>>,
		key: RepeatKey<Value>,
		template: RepeatItem<Value, Result>,
	): DirectiveResult<typeof RepeatSignalDirective<Value, Result>>;
};

interface RepeatEntry<Value, Result> {
	key: unknown;
	row: RepeatRow<Value, Result>;
}

interface RepeatRow<Value, Result> {
	computed: Signal.Computed<Result>;
	dispose: (() => void) | undefined;
	index: number;
	value: Value;
}
