import { exists, requested } from "./.internals.js";
import type { DBQueryOptions, StoreDefinition, StoreKey, StoreValue } from "./.types.js";

/** Promise-based read operations over an object store or index. */
export class DBQuery<Store extends StoreDefinition, Query extends IDBValidKey> {
	readonly #source: IDBIndex | IDBObjectStore;

	/** Wraps a native query source owned by an active transaction. */
	constructor(source: IDBIndex | IDBObjectStore) {
		this.#source = source;
	}

	/** Returns the first value matching a key or range. */
	get(query: Query | IDBKeyRange): Promise<StoreValue<Store> | undefined> {
		return requested(this.#source, "get", query);
	}

	/** Returns values matching the requested range and count. */
	getAll(options?: DBQueryOptions<Query>): Promise<StoreValue<Store>[]> {
		return requested(this.#source, "getAll", options?.query, options?.count);
	}

	/** Returns primary keys for records matching the requested range and count. */
	getAllKeys(options?: DBQueryOptions<Query>): Promise<StoreKey<Store>[]> {
		return requested(this.#source, "getAllKeys", options?.query, options?.count);
	}

	/** Returns whether at least one record matches a key or range. */
	has(query: Query | IDBKeyRange): Promise<boolean> {
		return requested<StoreKey<Store> | undefined>(this.#source, "getKey", query).then(exists);
	}

	/** Counts records matching a key or range, or every record when omitted. */
	count(query?: Query | IDBKeyRange | null): Promise<number> {
		return requested(this.#source, "count", query ?? undefined);
	}
}
