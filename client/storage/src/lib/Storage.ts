/// <reference lib="dom" />

/** Typed, observable access to local or session storage. */
export class Storage<Schema extends SchemaDefinition<Schema> = Storage.Schema> {
	/** The underlying platform `Storage` object. */
	readonly source: globalThis.Storage;

	readonly #subscriptions: Map<string, Set<Subscription>> = new Map();

	/**
	 * Creates a wrapper around local or session storage in a browsing context.
	 *
	 * @param type Selects `localStorage` or `sessionStorage`.
	 * @param target The window whose platform storage and `storage` events are used.
	 */
	constructor(
		type: "local" | "session" = "local",

		/** The window that owns the storage area and dispatches cross-document changes. */
		readonly target: StorageTarget = globalThis.window,
	) {
		this.source = target[`${type}Storage` as const];
	}

	/** Returns the number of stored keys. */
	get size(): number {
		return this.source.length;
	}

	/** Returns the value of a key, or null when the key is not set. */
	get<Key extends StorageKey<Schema>>(key: Key): StorageValue<Schema, Key> | null {
		return this.source.getItem(key) as StorageValue<Schema, Key> | null;
	}

	/** Returns whether a key is set. */
	has<Key extends StorageKey<Schema>>(key: Key): boolean {
		return this.get(key) !== null;
	}

	/**
	 * Sets a value, or removes it when the value is null. Returns whether storage changed.
	 * The mutation commits before synchronous subscriber failures are rethrown.
	 */
	set<Key extends StorageKey<Schema>>(key: Key, newValue: StorageValue<Schema, Key> | null): boolean {
		const oldValue = this.get(key);

		if (oldValue === newValue) {
			return false;
		}

		if (newValue === null) {
			this.source.removeItem(key);
		} else {
			this.source.setItem(key, newValue);
		}

		throwSubscriberErrors(this.#notify(changeFrom(key, oldValue, newValue)));

		return true;
	}

	/** Removes a key. Returns whether storage changed. */
	delete<Key extends StorageKey<Schema>>(key: Key): boolean {
		return this.set(key, null);
	}

	/**
	 * Clears every key. Returns whether storage changed.
	 * Subscribers to keys observed when the clear began are invalidated after the mutation commits.
	 */
	clear(): boolean {
		if (this.source.length === 0) {
			return false;
		}

		const keys = [...this.#subscriptions.keys()];
		const generation = subscriptionGeneration;

		this.source.clear();

		let errors: unknown[] | undefined;

		for (const key of keys) {
			errors = this.#notify({ kind: "invalidated", key }, errors, generation);
		}

		throwSubscriberErrors(errors);

		return true;
	}

	/**
	 * Subscribes to every change occurrence for one key from local writes and other documents.
	 * Subscribers run in registration order from a snapshot: reentrant additions wait for the next occurrence, while
	 * subscriptions removed before their turn are skipped. All remaining active subscribers run before one failure is
	 * rethrown by identity or multiple failures are combined in delivery order in an `AggregateError`. Clear events
	 * invalidate each key that was observed when the event began.
	 */
	subscribe<Key extends StorageKey<Schema>>(
		key: Key,
		subscriber: StorageSubscriber<Key, StorageValue<Schema, Key>>,
		options?: StorageSubscribeOptions,
	): () => void {
		const signal = options?.signal;

		if (signal?.aborted) {
			return noop;
		}

		let subscriptions = this.#subscriptions.get(key);

		const wasEmpty = this.#subscriptions.size === 0;

		if (subscriptions === undefined) {
			subscriptions = new Set();

			this.#subscriptions.set(key, subscriptions);
		}

		const subscription: Subscription = [subscriber as StorageSubscriber, ++subscriptionGeneration];

		subscriptions.add(subscription);

		if (wasEmpty) {
			this.target.addEventListener("storage", this.#handleStorage);
		}

		const unsubscribe = (): void => {
			if (!subscriptions.delete(subscription)) {
				return;
			}

			if (!subscriptions.size) {
				this.#subscriptions.delete(key);
			}

			if (!this.#subscriptions.size) {
				this.target.removeEventListener("storage", this.#handleStorage);
			}

			signal?.removeEventListener("abort", unsubscribe);
		};

		signal?.addEventListener("abort", unsubscribe, { once: true });

		return unsubscribe;
	}

	readonly #handleStorage = (event: StorageEvent): void => {
		if (event.storageArea !== this.source) {
			return;
		}

		let errors: unknown[] | undefined;

		if (event.key === null) {
			const generation = subscriptionGeneration;

			for (const key of [...this.#subscriptions.keys()]) {
				errors = this.#notify({ kind: "invalidated", key }, errors, generation);
			}
		} else {
			errors = this.#notify(changeFrom(event.key, event.oldValue, event.newValue));
		}

		throwSubscriberErrors(errors);
	};

	#notify(
		change: StorageChange,
		errors?: unknown[],
		generation: number = subscriptionGeneration,
	): unknown[] | undefined {
		const subscriptions = this.#subscriptions.get(change.key);

		if (subscriptions === undefined) {
			return errors;
		}

		for (const subscription of subscriptions) {
			if (subscription[1] > generation) {
				break;
			}

			try {
				subscription[0](change);
			} catch (error) {
				(errors ??= []).push(error);
			}
		}

		return errors;
	}
}

type StorageTarget = Window;

/** Schema declarations used by {@link Storage}. */
export namespace Storage {
	/** An unrestricted schema of string keys and values. */
	export type Schema = Record<string, string>;
}

/** Options for observing a storage key. */
export interface StorageSubscribeOptions {
	/** Unsubscribes when aborted. */
	signal?: AbortSignal;
}

/**
 * A discriminated record describing one observable change to a storage key.
 *
 * `invalidated` means the storage area was cleared and the current value should be read again if needed.
 */
export type StorageChange<Key extends string = string, Value extends string = string> =
	| {
			/** Identifies a previously absent key that now has a value. */
			readonly kind: "added";

			/** The changed key. */
			readonly key: Key;

			/** The value added to storage. */
			readonly value: Value;
	  }
	| {
			/** Identifies an existing key whose value changed. */
			readonly kind: "updated";

			/** The changed key. */
			readonly key: Key;

			/** The new stored value. */
			readonly value: Value;

			/** The value replaced by this change. */
			readonly previous: Value;
	  }
	| {
			/** Identifies a key removed from storage. */
			readonly kind: "removed";

			/** The changed key. */
			readonly key: Key;

			/** The value removed from storage. */
			readonly previous: Value;
	  }
	| {
			/** Identifies a key whose storage area was cleared. */
			readonly kind: "invalidated";

			/** The key whose current value should be read again if needed. */
			readonly key: Key;
	  };

/** A callback invoked synchronously for each observed storage change. */
export type StorageSubscriber<Key extends string = string, Value extends string = string> = (
	change: StorageChange<Key, Value>,
) => void;

/** The string keys declared by a storage schema. */
export type StorageKey<Schema> = Extract<keyof Schema, string>;

/** The string value declared for one key in a storage schema. */
export type StorageValue<Schema, Key extends StorageKey<Schema>> = Extract<Schema[Key], string>;

type SchemaDefinition<Schema> = { [Key in keyof Schema]-?: string };
type Subscription = readonly [subscriber: StorageSubscriber, generation: number];

let subscriptionGeneration = 0;

const changeFrom = <Key extends string, Value extends string>(
	key: Key,
	previous: Value | null,
	value: Value | null,
): StorageChange<Key, Value> =>
	previous === null
		? value === null
			? { kind: "invalidated", key }
			: { kind: "added", key, value }
		: value === null
			? { kind: "removed", key, previous }
			: { kind: "updated", key, previous, value };

const noop = (): void => {};

const throwSubscriberErrors = (errors?: unknown[]): void => {
	if (errors?.length === 1) {
		throw errors[0];
	}

	if (errors?.length) {
		throw new AggregateError(errors);
	}
};
