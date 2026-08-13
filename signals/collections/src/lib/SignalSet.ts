import { Signal } from "@serve-tools/signal";

import { consumeKey, type VersionSignal, versionSignal } from "./.internals.js";

/** A Set with signal-backed membership and iteration reads. */
export class SignalSet<Value = unknown> extends Set<Value> {
	#members: Map<Value, VersionSignal> | undefined;

	#collection: VersionSignal | undefined;

	/** Creates a signal-backed Set from optional values. */
	constructor(values?: readonly Value[] | Iterable<Value> | null) {
		super();

		if (values !== undefined && values !== null) {
			for (const value of values) {
				super.add(value);
			}
		}
	}

	/** Returns whether a value exists and tracks changes to that membership. */
	override has(value: Value): boolean {
		if (Signal.subtle.currentComputed() !== undefined) {
			consumeKey((this.#members ??= new Map()), value);
		}

		return super.has(value);
	}

	/** Returns an entry iterator and tracks changes across the Set. */
	override entries(): SetIterator<[Value, Value]> {
		this.#consume();

		return super.entries();
	}

	/** Returns a value iterator and tracks changes across the Set. */
	override keys(): SetIterator<Value> {
		return this.values();
	}

	/** Returns a value iterator and tracks changes across the Set. */
	override values(): SetIterator<Value> {
		this.#consume();

		return super.values();
	}

	/** Visits values and tracks changes across the Set. */
	override forEach(callback: (value: Value, key: Value, set: Set<Value>) => void, thisArg?: unknown): void {
		this.#consume();

		super.forEach(callback, thisArg);
	}

	/** Returns the value count and tracks changes across the Set. */
	override get size(): number {
		this.#consume();

		return super.size;
	}

	/** Returns a value iterator and tracks changes across the Set. */
	override [Symbol.iterator](): SetIterator<Value> {
		return this.values();
	}

	/** Adds a value and invalidates tracked reads when it was absent. */
	override add(value: Value): this {
		if (super.has(value)) {
			return this;
		}

		super.add(value);

		this.#members?.get(value)?.set(undefined);
		this.#collection?.set(undefined);

		return this;
	}

	/** Deletes a value and invalidates tracked reads when it existed. */
	override delete(value: Value): boolean {
		if (!super.delete(value)) {
			return false;
		}

		this.#members?.get(value)?.set(undefined);
		this.#members?.delete(value);
		this.#collection?.set(undefined);

		return true;
	}

	/** Removes every value and invalidates tracked reads when the Set was nonempty. */
	override clear(): void {
		if (super.size === 0) {
			return;
		}

		super.clear();

		const members = this.#members;

		if (members !== undefined) {
			for (const signal of members.values()) {
				signal.set(undefined);
			}

			members.clear();
		}

		this.#collection?.set(undefined);
	}

	#consume(): void {
		if (Signal.subtle.currentComputed() !== undefined) {
			(this.#collection ??= versionSignal()).get();
		}
	}
}
