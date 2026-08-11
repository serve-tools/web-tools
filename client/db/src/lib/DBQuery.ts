import { exists, requested } from "./.internals.js";
import type { DBQueryOptions, StoreDefinition, StoreKey, StoreValue } from "./.types.js";

export class DBQuery<Store extends StoreDefinition, Query extends IDBValidKey> {
	readonly #source: IDBIndex | IDBObjectStore;

	constructor(source: IDBIndex | IDBObjectStore) {
		this.#source = source;
	}

	get(query: Query | IDBKeyRange): Promise<StoreValue<Store> | undefined> {
		return requested(this.#source, "get", query);
	}

	getAll(options?: DBQueryOptions<Query>): Promise<StoreValue<Store>[]> {
		return requested(this.#source, "getAll", options?.query, options?.count);
	}

	getAllKeys(options?: DBQueryOptions<Query>): Promise<StoreKey<Store>[]> {
		return requested(this.#source, "getAllKeys", options?.query, options?.count);
	}

	has(query: Query | IDBKeyRange): Promise<boolean> {
		return requested<StoreKey<Store> | undefined>(this.#source, "getKey", query).then(exists);
	}

	count(query?: Query | IDBKeyRange | null): Promise<number> {
		return requested(this.#source, "count", query ?? undefined);
	}
}
