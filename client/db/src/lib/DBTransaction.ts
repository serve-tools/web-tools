import { completion, noop } from "./.internals.js";
import type {
	DBTransaction as DBTransactionInterface,
	NativeTransaction,
	SchemaDefinition,
	StoreName,
} from "./.types.js";
import { DBObjectStore } from "./DBObjectStore.js";

/** A transaction whose stores and completion are exposed through promises. */
export class DBTransaction<Schema extends SchemaDefinition<Schema>, Names extends StoreName<Schema>>
	implements DBTransactionInterface<Schema, Names>
{
	readonly #source: NativeTransaction<Schema, Names>;

	/** Settles after commit, or rejects when the transaction aborts or its cancellation signal fires. */
	readonly done: Promise<void>;

	/** Wraps an active native transaction and optionally binds it to a cancellation signal. */
	constructor(source: NativeTransaction<Schema, Names>, signal?: AbortSignal) {
		this.#source = source;

		this.done = completion(source, signal);

		this.done.catch(noop);
	}

	/** Opens a store included in the transaction's scope. */
	objectStore<Name extends Names>(name: Name): DBObjectStore<Schema[Name]> {
		return new DBObjectStore(this.#source.objectStore(name));
	}

	/** Aborts the transaction and rejects pending operations and {@link done}. */
	abort(): void {
		this.#source.abort();
	}

	/** Requests an early commit after outstanding requests complete. */
	commit(): void {
		this.#source.commit();
	}
}
