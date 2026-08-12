import type { DB } from "./DB.js";

/** The value, primary-key, and index-key types of one schema object store. */
export interface DBStore<
	Value = unknown,
	Key extends IDBValidKey = IDBValidKey,
	Indexes extends Record<string, IDBValidKey> = never,
> {
	/** The object store's primary-key type. */
	key: Key;

	/** The structured-clone value stored in the object store. */
	value: Value;

	/** A mapping from index names to their index-key types. */
	indexes?: Indexes;
}

/** An unrestricted schema of string-named IndexedDB object stores. */
export type DBSchema = Record<string, DBStore<unknown, IDBValidKey, Record<string, IDBValidKey>>>;

export type StoreDefinition = DBStore<unknown, IDBValidKey, Record<string, IDBValidKey>>;
export type SchemaDefinition<Schema> = { [Name in keyof Schema]: StoreDefinition };

/** The string names of object stores declared by a schema. */
export type StoreName<Schema> = Extract<keyof Schema, string>;

/** The primary-key type declared by an object store. */
export type StoreKey<Store extends StoreDefinition> = Store["key"];

/** The structured-clone value type declared by an object store. */
export type StoreValue<Store extends StoreDefinition> = Store["value"];
export type Indexes<Store extends StoreDefinition> = "indexes" extends keyof Store
	? NonNullable<Store["indexes"]>
	: never;
export type IndexName<Store extends StoreDefinition> = Extract<keyof Indexes<Store>, string>;

/** A key/value record returned by a scan. */
export interface DBEntry<Store extends StoreDefinition> {
	/** The record's primary key. */
	readonly key: StoreKey<Store>;

	/** The stored structured-clone value. */
	readonly value: StoreValue<Store>;
}

/** Promise-based access to an index inside a transaction. */
export interface DBIndex<Store extends StoreDefinition, Name extends IndexName<Store>> {
	/** Counts records whose index keys match `query`, or every record when omitted. */
	count(query?: Indexes<Store>[Name] | IDBKeyRange | null): Promise<number>;

	/** Returns the first value whose index key matches `query`. */
	get(query: Indexes<Store>[Name] | IDBKeyRange): Promise<StoreValue<Store> | undefined>;

	/** Returns values whose index keys match the requested range. */
	getAll(options?: DBQueryOptions<Indexes<Store>[Name]>): Promise<StoreValue<Store>[]>;

	/** Returns primary keys for records whose index keys match the requested range. */
	getAllKeys(options?: DBQueryOptions<Indexes<Store>[Name]>): Promise<StoreKey<Store>[]>;

	/** Returns whether at least one record has an index key matching `query`. */
	has(query: Indexes<Store>[Name] | IDBKeyRange): Promise<boolean>;
}

/** Promise-based access to an object store inside a transaction. */
export interface DBObjectStore<Store extends StoreDefinition> {
	/** Adds a new record and rejects if its primary key already exists. */
	add(value: StoreValue<Store>, key?: StoreKey<Store>): Promise<StoreKey<Store>>;

	/** Removes every record from the object store. */
	clear(): Promise<void>;

	/** Counts records whose primary keys match `query`, or every record when omitted. */
	count(query?: StoreKey<Store> | IDBKeyRange | null): Promise<number>;

	/** Removes records whose primary keys match `query`. */
	delete(query: StoreKey<Store> | IDBKeyRange): Promise<void>;

	/** Returns the first value whose primary key matches `query`. */
	get(query: StoreKey<Store> | IDBKeyRange): Promise<StoreValue<Store> | undefined>;

	/** Returns values whose primary keys match the requested range. */
	getAll(options?: DBQueryOptions<StoreKey<Store>>): Promise<StoreValue<Store>[]>;

	/** Returns primary keys matching the requested range. */
	getAllKeys(options?: DBQueryOptions<StoreKey<Store>>): Promise<StoreKey<Store>[]>;

	/** Returns whether at least one record has a primary key matching `query`. */
	has(query: StoreKey<Store> | IDBKeyRange): Promise<boolean>;

	/** Opens a schema-declared index from this object store. */
	index<Name extends IndexName<Store>>(name: Name): DBIndex<Store, Name>;

	/** Adds or replaces a record. */
	put(value: StoreValue<Store>, key?: StoreKey<Store>): Promise<StoreKey<Store>>;
}

/** A transaction whose stores expose promises instead of IDBRequest objects. */
export interface DBTransaction<Schema extends SchemaDefinition<Schema>, Names extends StoreName<Schema>> {
	/** Settles when the transaction commits or aborts. */
	readonly done: Promise<void>;

	/** Aborts the transaction and rejects pending operations and {@link done}. */
	abort(): void;

	/** Requests an early commit after all outstanding requests complete. */
	commit(): void;

	/** Opens a store included in the transaction's scope. */
	objectStore<Name extends Names>(name: Name): DBObjectStore<Schema[Name]>;
}

/** Options for opening an IndexedDB connection. */
export interface DBOpenOptions<Schema extends SchemaDefinition<Schema>> {
	/** The requested database version. Omit it to open the current version. */
	version?: number;

	/** Called when the open request is blocked by another connection. */
	blocked?(event: IDBVersionChangeEvent): void;

	/** Called when the browser unexpectedly closes the connection. */
	close?(database: DB<Schema>, event: Event): void;

	/** Synchronously configures stores and indexes inside the native versionchange transaction. */
	upgrade?(database: DBUpgradeDatabase<Schema>, context: DBUpgradeContext<Schema>): void;

	/** Called when another context requests a newer version or deletion. Defaults to closing this connection. */
	versionchange?(database: DB<Schema>, event: IDBVersionChangeEvent): void;
}

/** Options for deleting an IndexedDB database. */
export interface DBDeleteOptions {
	/** Called when deletion is blocked by an open connection. */
	blocked?(event: IDBVersionChangeEvent): void;
}

/** Options shared by cancellable database operations. */
export interface DBOperationOptions {
	/** Aborts the operation's transaction and rejects with the signal's reason. */
	signal?: AbortSignal;
}

/** Options for a standalone write transaction. */
export interface DBMutationOptions extends DBOperationOptions, IDBTransactionOptions {}

/** Options for adding or replacing one record. */
export interface DBWriteOptions<Store extends StoreDefinition> extends DBMutationOptions {
	/** An explicit primary key for stores without an inline key path. */
	key?: StoreKey<Store>;
}

/** Options for creating a manual or callback transaction. */
export interface DBTransactionOptions extends IDBTransactionOptions, DBOperationOptions {
	/** The native transaction mode. @default "readonly" */
	mode?: Exclude<IDBTransactionMode, "versionchange">;
}

/** A bounded object-store or index query. */
export interface DBQueryOptions<Query extends IDBValidKey> {
	/** The maximum number of matching records to return. */
	count?: number;

	/** A key, key range, or `null` to match every record. */
	query?: Query | IDBKeyRange | null;
}

/** Options for standalone `getAll` and `getAllKeys` operations. */
export interface DBGetAllOptions<Store extends StoreDefinition>
	extends DBOperationOptions,
		DBQueryOptions<StoreKey<Store>> {}

/** Options for a standalone count operation. */
export interface DBCountOptions<Store extends StoreDefinition> extends DBOperationOptions {
	/** A primary key, key range, or `null` to count every record. */
	query?: StoreKey<Store> | IDBKeyRange | null;
}

/** Options for paged asynchronous iteration over an object store. */
export interface DBScanOptions<Store extends StoreDefinition> extends DBOperationOptions {
	/** Records fetched per read transaction. @default 100 */
	batchSize?: number;

	/** The primary-key traversal direction. @default "next" */
	direction?: "next" | "prev";

	/** Maximum number of records yielded. */
	limit?: number;

	/** A primary key, key range, or `null` to scan every record. */
	query?: StoreKey<Store> | IDBKeyRange | null;
}

/** Version information and the native transaction available during an upgrade. */
export interface DBUpgradeContext<Schema extends SchemaDefinition<Schema>> {
	/** The requested version reported by the native versionchange event. */
	readonly newVersion: number | null;

	/** The version that existed before this upgrade, or `0` for a new database. */
	readonly oldVersion: number;

	/** The schema-aware native versionchange transaction. */
	readonly transaction: DBUpgradeTransaction<Schema>;
}

/** A native `IDBDatabase` with schema-aware object-store creation. */
export type DBUpgradeDatabase<Schema extends SchemaDefinition<Schema>> = Omit<IDBDatabase, "createObjectStore"> & {
	/** Creates a schema-declared object store. */
	createObjectStore<Name extends StoreName<Schema>>(
		name: Name,
		options?: IDBObjectStoreParameters,
	): DBUpgradeObjectStore<Schema[Name]>;
};

/** A native `IDBObjectStore` with schema-aware index creation. */
export type DBUpgradeObjectStore<Store extends StoreDefinition> = Omit<NativeObjectStore<Store>, "createIndex"> & {
	/** Creates a schema-declared index. */
	createIndex<Name extends IndexName<Store>>(
		name: Name,
		keyPath: string | string[],
		options?: IDBIndexParameters,
	): NativeIndex<Store, Name>;
};

/** A native versionchange transaction with schema-aware object-store access. */
export type DBUpgradeTransaction<Schema extends SchemaDefinition<Schema>> = Omit<IDBTransaction, "objectStore"> & {
	/** Opens a schema-declared object store. */
	objectStore<Name extends StoreName<Schema>>(name: Name): DBUpgradeObjectStore<Schema[Name]>;
};

/** A function executed with a promise-based transaction that may return a value or promise. */
export type DBTransactionCallback<Schema extends SchemaDefinition<Schema>, Names extends StoreName<Schema>, Result> = (
	transaction: DBTransaction<Schema, Names>,
) => Result;

export type NativeTransaction<Schema extends SchemaDefinition<Schema>, Names extends StoreName<Schema>> = Omit<
	IDBTransaction,
	"objectStore"
> & {
	objectStore<Name extends Names>(name: Name): NativeObjectStore<Schema[Name]>;
};

export type NativeObjectStore<Store extends StoreDefinition> = Omit<
	IDBObjectStore,
	"add" | "delete" | "get" | "getAll" | "getAllKeys" | "getKey" | "index" | "put"
> & {
	add(value: StoreValue<Store>, key?: StoreKey<Store>): IDBRequest<StoreKey<Store>>;
	delete(query: StoreKey<Store> | IDBKeyRange): IDBRequest<undefined>;
	get(query: StoreKey<Store> | IDBKeyRange): IDBRequest<StoreValue<Store> | undefined>;
	getAll(query?: StoreKey<Store> | IDBKeyRange | null, count?: number): IDBRequest<StoreValue<Store>[]>;
	getAllKeys(query?: StoreKey<Store> | IDBKeyRange | null, count?: number): IDBRequest<StoreKey<Store>[]>;
	getKey(query: StoreKey<Store> | IDBKeyRange): IDBRequest<StoreKey<Store> | undefined>;
	index<Name extends IndexName<Store>>(name: Name): NativeIndex<Store, Name>;
	put(value: StoreValue<Store>, key?: StoreKey<Store>): IDBRequest<StoreKey<Store>>;
};

export type NativeIndex<Store extends StoreDefinition, Name extends IndexName<Store>> = Omit<
	IDBIndex,
	"get" | "getAll" | "getAllKeys" | "getKey"
> & {
	get(query: Indexes<Store>[Name] | IDBKeyRange): IDBRequest<StoreValue<Store> | undefined>;
	getAll(query?: Indexes<Store>[Name] | IDBKeyRange | null, count?: number): IDBRequest<StoreValue<Store>[]>;
	getAllKeys(query?: Indexes<Store>[Name] | IDBKeyRange | null, count?: number): IDBRequest<StoreKey<Store>[]>;
	getKey(query: Indexes<Store>[Name] | IDBKeyRange): IDBRequest<StoreKey<Store> | undefined>;
};

export type Method = "get" | "getAll" | "getAllKeys" | "getKey" | "count" | "add" | "put" | "delete" | "clear";

export type Operation<Result> = (value?: unknown, keyOrCount?: IDBValidKey | number) => IDBRequest<Result>;
