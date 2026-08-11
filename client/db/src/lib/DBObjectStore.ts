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

export class DBObjectStore<Store extends StoreDefinition>
	extends DBQuery<Store, StoreKey<Store>>
	implements DBObjectStoreInterface<Store>
{
	readonly #source: IDBObjectStore;

	constructor(source: IDBObjectStore) {
		super(source);

		this.#source = source;
	}

	add(value: StoreValue<Store>, key?: StoreKey<Store>): Promise<StoreKey<Store>> {
		return requested(this.#source, "add", value, key);
	}

	put(value: StoreValue<Store>, key?: StoreKey<Store>): Promise<StoreKey<Store>> {
		return requested(this.#source, "put", value, key);
	}

	delete(query: StoreKey<Store> | IDBKeyRange): Promise<void> {
		return requested(this.#source, "delete", query);
	}

	clear(): Promise<void> {
		return requested(this.#source, "clear");
	}

	index<Name extends IndexName<Store>>(name: Name): DBIndex<Store, Name> {
		return new DBQuery<Store, Indexes<Store>[Name]>(this.#source.index(name));
	}
}
