import { Signal } from "@serve-tools/signal";
import type { VersionSignal } from "./.internals.js";
import { consumeKey, dirty, dirtyAll, versionSignal } from "./.internals.js";

/** A Map with signal-backed key and iteration reads. */
export class SignalMap<Key = unknown, Value = unknown> extends Map<Key, Value> {
	#presence: Map<Key, VersionSignal> | undefined;
	#values: Map<Key, VersionSignal> | undefined;
	#structure: VersionSignal | undefined;
	#contents: VersionSignal | undefined;

	/** Creates a signal-backed Map from optional entries. */
	constructor(entries?: readonly (readonly [Key, Value])[] | Iterable<readonly [Key, Value]> | null) {
		super();

		if (entries !== undefined && entries !== null) {
			for (const [key, value] of entries) {
				super.set(key, value);
			}
		}
	}

	/** Returns a value and tracks changes to that key's value. */
	override get(key: Key): Value | undefined {
		if (Signal.subtle.currentComputed() !== undefined) {
			consumeKey((this.#values ??= new Map()), key);
		}

		return super.get(key);
	}

	/** Returns whether a key exists and tracks changes to that key's presence. */
	override has(key: Key): boolean {
		if (Signal.subtle.currentComputed() !== undefined) {
			consumeKey((this.#presence ??= new Map()), key);
		}

		return super.has(key);
	}

	/** Returns an iterator and tracks key or value changes across the Map. */
	override entries(): MapIterator<[Key, Value]> {
		this.#consumeContents();

		return super.entries();
	}

	/** Returns an iterator and tracks additions or removals of keys. */
	override keys(): MapIterator<Key> {
		this.#consumeStructure();

		return super.keys();
	}

	/** Returns an iterator and tracks key or value changes across the Map. */
	override values(): MapIterator<Value> {
		this.#consumeContents();

		return super.values();
	}

	/** Visits entries and tracks key or value changes across the Map. */
	override forEach(callback: (value: Value, key: Key, map: Map<Key, Value>) => void, thisArg?: unknown): void {
		this.#consumeContents();

		super.forEach(callback, thisArg);
	}

	/** Returns the entry count and tracks additions or removals of keys. */
	override get size(): number {
		this.#consumeStructure();

		return super.size;
	}

	/** Returns an entry iterator and tracks key or value changes across the Map. */
	override [Symbol.iterator](): MapIterator<[Key, Value]> {
		return this.entries();
	}

	/** Adds or replaces a value and invalidates only affected reactive reads. */
	override set(key: Key, value: Value): this {
		const present = super.has(key);

		if (present && Object.is(super.get(key), value)) {
			return this;
		}

		super.set(key, value);

		dirty(this.#values?.get(key));
		dirty(this.#contents);

		if (!present) {
			dirty(this.#presence?.get(key));
			dirty(this.#structure);
		}

		return this;
	}

	/** Deletes a key and invalidates affected reactive reads when it existed. */
	override delete(key: Key): boolean {
		if (!super.delete(key)) {
			return false;
		}

		dirty(this.#presence?.get(key));
		dirty(this.#values?.get(key));

		this.#presence?.delete(key);
		this.#values?.delete(key);

		dirty(this.#structure);
		dirty(this.#contents);

		return true;
	}

	/** Removes every entry and invalidates tracked reads when the Map was nonempty. */
	override clear(): void {
		if (super.size === 0) {
			return;
		}

		super.clear();

		dirtyAll(this.#presence);
		dirtyAll(this.#values);

		this.#presence?.clear();
		this.#values?.clear();

		dirty(this.#structure);
		dirty(this.#contents);
	}

	#consumeStructure(): void {
		if (Signal.subtle.currentComputed() !== undefined) {
			(this.#structure ??= versionSignal()).get();
		}
	}

	#consumeContents(): void {
		if (Signal.subtle.currentComputed() !== undefined) {
			(this.#contents ??= versionSignal()).get();
		}
	}
}
