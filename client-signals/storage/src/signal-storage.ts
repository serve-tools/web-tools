/// <reference lib="esnext.disposable" preserve="true" />

import { Storage as ClientStorage, type StorageKey, type StorageValue } from "@serve-tools/client-storage";
import { Signal } from "@serve-tools/signal";

export type {
	StorageChange,
	StorageKey,
	StorageSubscribeOptions,
	StorageSubscriber,
	StorageValue,
} from "@serve-tools/client-storage";

class ReactiveStorageValue<Schema extends SchemaDefinition<Schema>, Key extends StorageKey<Schema>>
	extends Signal.Computed<StorageValue<Schema, Key> | null>
	implements Disposable
{
	readonly #refreshValue: () => void;

	#unsubscribe: (() => void) | undefined;

	constructor(storage: ClientStorage<Schema>, key: Key) {
		const state = new Signal.State<StorageValue<Schema, Key> | null>(storage.get(key));

		super(() => state.get());

		this.#refreshValue = () => state.set(storage.get(key));

		this.#unsubscribe = storage.subscribe(key, (change) =>
			state.set(
				change.kind === "invalidated" ? storage.get(key) : change.kind === "removed" ? null : change.value,
			),
		);
	}

	refresh(): void {
		if (this.#unsubscribe) {
			this.#refreshValue();
		}
	}

	dispose(): void {
		const unsubscribe = this.#unsubscribe;

		if (unsubscribe === undefined) {
			return;
		}

		this.#unsubscribe = undefined;

		unsubscribe();
	}

	[Symbol.dispose](): void {
		this.dispose();
	}
}

/** Typed, observable Web Storage with read-only signal-backed key watches. */
export class SignalStorage<
	Schema extends SchemaDefinition<Schema> = SignalStorage.Schema,
> extends ClientStorage<Schema> {
	/**
	 * Returns a read-only computed signal containing the current value of one key.
	 * Known changes apply their exact delta; invalidation and `refresh()` reread storage synchronously. Signal consumers
	 * may coalesce changes. Disposal is idempotent, freezes the last value, and makes later refreshes no-ops.
	 */
	watch<Key extends StorageKey<Schema>>(key: Key): StorageSignal<StorageValue<Schema, Key>> {
		return new ReactiveStorageValue(this, key);
	}
}

/** Schema declarations used by {@link SignalStorage}. */
export namespace SignalStorage {
	/** An unrestricted schema of string keys and values. */
	export type Schema = ClientStorage.Schema;
}

/** A read-only computed storage value with synchronous refresh and an explicit observation lifecycle. */
export type StorageSignal<Value extends string = string> = InstanceType<typeof Signal.Computed<Value | null>> &
	Disposable & {
		/** Stops observation once and freezes the last value. */
		dispose(): void;

		/** Rereads storage synchronously while observation is active. */
		refresh(): void;
	};

type SchemaDefinition<Schema> = { [Key in keyof Schema]-?: string };
