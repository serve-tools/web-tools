import { requested } from "./.internals.js";
import type {
	DBIndex,
	DBObjectStore as DBObjectStoreInterface,
	Indexes,
	IndexName,
	StoreDefinition,
	StoreKey,
	StoreValue,
} from "./.types.js";
import { DBQuery } from "./DBQuery.js";

/** Promise-based mutation and query operations for one transaction-scoped object store. */
export class DBObjectStore<Store extends StoreDefinition>
	extends DBQuery<Store, StoreKey<Store>>
	implements DBObjectStoreInterface<Store>
{
	readonly #source: IDBObjectStore;

	/** Wraps a native object store owned by an active transaction. */
	constructor(source: IDBObjectStore) {
		super(source);

		this.#source = source;
	}

	/** Adds a record and rejects when its primary key already exists. */
	add(value: StoreValue<Store>, key?: StoreKey<Store>): Promise<StoreKey<Store>> {
		return requested(this.#source, "add", value, key);
	}

	/** Adds or replaces a record and resolves with its primary key. */
	put(value: StoreValue<Store>, key?: StoreKey<Store>): Promise<StoreKey<Store>> {
		return requested(this.#source, "put", value, key);
	}

	/** Removes records whose primary keys match the query. */
	delete(query: StoreKey<Store> | IDBKeyRange): Promise<void> {
		return requested(this.#source, "delete", query);
	}

	/** Removes every record from the object store. */
	clear(): Promise<void> {
		return requested(this.#source, "clear");
	}

	/** Opens a schema-declared index within the same transaction. */
	index<Name extends IndexName<Store>>(name: Name): DBIndex<Store, Name> {
		return new DBQuery<Store, Indexes<Store>[Name]>(this.#source.index(name));
	}
}
