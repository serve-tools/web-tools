import { completion, noop } from "./.internals.js";
import type {
	DBTransaction as DBTransactionInterface,
	NativeTransaction,
	SchemaDefinition,
	StoreName,
} from "./.types.js";
import { DBObjectStore } from "./DBObjectStore.js";

export class DBTransaction<Schema extends SchemaDefinition<Schema>, Names extends StoreName<Schema>>
	implements DBTransactionInterface<Schema, Names>
{
	readonly #source: NativeTransaction<Schema, Names>;
	readonly done: Promise<void>;

	constructor(source: NativeTransaction<Schema, Names>, signal?: AbortSignal) {
		this.#source = source;

		this.done = completion(source, signal);

		this.done.catch(noop);
	}

	objectStore<Name extends Names>(name: Name): DBObjectStore<Schema[Name]> {
		return new DBObjectStore(this.#source.objectStore(name));
	}

	abort(): void {
		this.#source.abort();
	}

	commit(): void {
		this.#source.commit();
	}
}
