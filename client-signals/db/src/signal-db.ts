/// <reference lib="esnext.disposable" preserve="true" />

import type {
	DBCountOptions,
	DBEntry,
	DBGetAllOptions,
	DBMutationOptions,
	DBOpenOptions,
	DBOperationOptions,
	DBScanOptions,
	DBTransaction,
	DBTransactionCallback,
	DBTransactionOptions,
	DBWriteOptions,
	StoreKey,
	StoreName,
	StoreValue,
} from "@serve-tools/client-db";
import { DB } from "@serve-tools/client-db";
import type { AnySignal } from "@serve-tools/signal";
import { Signal } from "@serve-tools/signal";
import { createEffect } from "@serve-tools/signal-effect";

export type * from "@serve-tools/client-db";

const pending = { status: "pending" } as const;

class ReactiveQuery<T> extends Signal.Computed<QueryState<T>> implements Query<T> {
	readonly #invalidate: () => void;
	readonly #refresh: (options?: DBOperationOptions) => Promise<void>;
	readonly #stop: () => void;

	constructor(read: (options?: DBOperationOptions) => Promise<T>, onDispose: () => void) {
		const state = new Signal.State<QueryState<T>>(pending);

		super(() => state.get());

		const invalidation = new Signal.State(0);
		let current = Promise.resolve();
		let disposed = false;
		let generation = 0;
		const disposedResult = Promise.withResolvers<never>();

		void disposedResult.promise.catch(() => {});

		const refresh = (options?: DBOperationOptions): Promise<void> => {
			if (disposed) {
				return Promise.reject(new DOMException("Query is disposed", "InvalidStateError"));
			}

			const request = ++generation;
			let result: Promise<QueryState<T>>;

			state.set(pending);

			try {
				result = Promise.race([read(options), disposedResult.promise]).then<QueryState<T>, QueryState<T>>(
					(value) => ({ status: "ready", value }),
					(error: unknown) => ({ status: "error", error }),
				);
			} catch (error) {
				result = Promise.resolve({ status: "error", error });
			}

			current = result.then((nextState) => {
				if (request !== generation) {
					return current;
				}

				state.set(nextState);
			});

			return current;
		};
		const controller = createEffect(() => {
			invalidation.get();
			void refresh();
		});

		this.#invalidate = () => invalidation.set(invalidation.get() + 1);
		this.#refresh = refresh;
		this.#stop = () => {
			if (disposed) {
				return;
			}

			disposed = true;
			disposedResult.reject(new DOMException("Query is disposed", "InvalidStateError"));
			controller.dispose();
			onDispose();
		};

		controller.start();
	}

	invalidate(): void {
		this.#invalidate();
	}

	refresh(options?: DBOperationOptions): Promise<void> {
		return this.#refresh(options);
	}

	dispose(): void {
		this.#stop();
	}

	[Symbol.dispose](): void {
		this.dispose();
	}
}

/** A typed IndexedDB connection with signal-backed reactive queries. */
export class SignalDB<Schema extends SchemaDefinition<Schema> = SignalDB.Schema> implements Disposable {
	readonly #queries = new Map<StoreName<Schema>, Set<ReactiveQuery<unknown>>>();

	/** Wraps an existing database connection and owns the reactive queries created through it. */
	constructor(
		/** The underlying typed IndexedDB connection. */
		readonly source: DB<Schema>,
	) {}

	/** Opens a database and wraps it with signal-backed queries. */
	static async open<Schema extends SchemaDefinition<Schema> = SignalDB.Schema>(
		name: string,
		options?: DBOpenOptions<Schema>,
	): Promise<SignalDB<Schema>> {
		return new this<Schema>(await DB.open<Schema>(name, options));
	}

	/** Returns the value for a primary key or range, or `undefined` when no record matches. */
	get<Name extends StoreName<Schema>>(
		storeName: Name,
		key: StoreKey<Schema[Name]> | IDBKeyRange,
		options?: DBOperationOptions,
	): Promise<StoreValue<Schema[Name]> | undefined> {
		return this.source.get(storeName, key, options);
	}

	/** Returns values matching an optional primary-key query after the read transaction commits. */
	getAll<Name extends StoreName<Schema>>(
		storeName: Name,
		options?: DBGetAllOptions<Schema[Name]>,
	): Promise<StoreValue<Schema[Name]>[]> {
		return this.source.getAll(storeName, options);
	}

	/** Returns primary keys matching an optional query after the read transaction commits. */
	getAllKeys<Name extends StoreName<Schema>>(
		storeName: Name,
		options?: DBGetAllOptions<Schema[Name]>,
	): Promise<StoreKey<Schema[Name]>[]> {
		return this.source.getAllKeys(storeName, options);
	}

	/** Returns whether a primary key or range matches at least one record. */
	has<Name extends StoreName<Schema>>(
		storeName: Name,
		key: StoreKey<Schema[Name]> | IDBKeyRange,
		options?: DBOperationOptions,
	): Promise<boolean> {
		return this.source.has(storeName, key, options);
	}

	/** Counts records matching an optional primary-key query. */
	count<Name extends StoreName<Schema>>(storeName: Name, options?: DBCountOptions<Schema[Name]>): Promise<number> {
		return this.source.count(storeName, options);
	}

	/** Adds a record and refreshes the store's active queries after the write commits. */
	add<Name extends StoreName<Schema>>(
		storeName: Name,
		value: StoreValue<Schema[Name]>,
		options?: DBWriteOptions<Schema[Name]>,
	): Promise<StoreKey<Schema[Name]>> {
		return this.source.add(storeName, value, options).then((key) => {
			this.invalidate(storeName);

			return key;
		});
	}

	/** Adds or replaces a record and refreshes the store's active queries after the write commits. */
	put<Name extends StoreName<Schema>>(
		storeName: Name,
		value: StoreValue<Schema[Name]>,
		options?: DBWriteOptions<Schema[Name]>,
	): Promise<StoreKey<Schema[Name]>> {
		return this.source.put(storeName, value, options).then((key) => {
			this.invalidate(storeName);

			return key;
		});
	}

	/** Deletes matching records and refreshes the store's active queries after the write commits. */
	delete<Name extends StoreName<Schema>>(
		storeName: Name,
		key: StoreKey<Schema[Name]> | IDBKeyRange,
		options?: DBMutationOptions,
	): Promise<void> {
		return this.source.delete(storeName, key, options).then(() => this.invalidate(storeName));
	}

	/** Removes every store record and refreshes its active queries after the write commits. */
	clear<Name extends StoreName<Schema>>(storeName: Name, options?: DBMutationOptions): Promise<void> {
		return this.source.clear(storeName, options).then(() => this.invalidate(storeName));
	}

	/** Opens a typed transaction and refreshes affected queries when a read/write transaction commits. */
	transaction<const Names extends StoreName<Schema>>(
		storeNames: Names | readonly Names[],
		options?: DBTransactionOptions,
	): DBTransaction<Schema, Names>;

	/** Runs a transaction callback and refreshes affected queries after a successful read/write commit. */
	transaction<const Names extends StoreName<Schema>, Result>(
		storeNames: Names | readonly Names[],
		options: DBTransactionOptions,
		callback: DBTransactionCallback<Schema, Names, Result>,
	): Promise<Awaited<Result>>;

	transaction<const Names extends StoreName<Schema>, Result>(
		storeNames: Names | readonly Names[],
		options?: DBTransactionOptions,
		callback?: DBTransactionCallback<Schema, Names, Result>,
	): DBTransaction<Schema, Names> | Promise<Awaited<Result>> {
		const invalidate = (): void => {
			if (options?.mode !== undefined && options.mode !== "readonly") {
				this.invalidate(storeNames);
			}
		};

		if (callback) {
			return this.source.transaction(storeNames, options ?? {}, callback).then((value) => {
				invalidate();

				return value;
			});
		}

		const transaction = this.source.transaction(storeNames, options);

		void transaction.done.then(invalidate, () => undefined);

		return transaction;
	}

	/** Scans key/value entries in independently committed pages. */
	scan<Name extends StoreName<Schema>>(
		storeName: Name,
		options?: DBScanOptions<Schema[Name]>,
	): AsyncGenerator<DBEntry<Schema[Name]>, void, undefined> {
		return this.source.scan(storeName, options);
	}

	/** Scans primary keys in independently committed pages. */
	scanKeys<Name extends StoreName<Schema>>(
		storeName: Name,
		options?: DBScanOptions<Schema[Name]>,
	): AsyncGenerator<StoreKey<Schema[Name]>, void, undefined> {
		return this.source.scanKeys(storeName, options);
	}

	/** Scans record values in independently committed pages. */
	scanValues<Name extends StoreName<Schema>>(
		storeName: Name,
		options?: DBScanOptions<Schema[Name]>,
	): AsyncGenerator<StoreValue<Schema[Name]>, void, undefined> {
		return this.source.scanValues(storeName, options);
	}

	/** Refreshes every active query for one or more stores. */
	invalidate<const Names extends StoreName<Schema>>(storeNames: Names | readonly Names[]): void {
		const names = typeof storeNames === "string" ? [storeNames] : storeNames;

		for (const storeName of names) {
			for (const query of this.#queries.get(storeName) ?? []) {
				query.invalidate();
			}
		}
	}

	/** Watches one primary-key query and refreshes it after committed writes through this wrapper. */
	watch<Name extends StoreName<Schema>>(
		storeName: Name,
		key: Watchable<StoreKey<Schema[Name]> | IDBKeyRange>,
	): Query<StoreValue<Schema[Name]> | undefined> {
		return this.#query(storeName, (options) => this.get(storeName, valueOf(key), options));
	}

	/** Watches all matching values and refreshes them after committed writes through this wrapper. */
	watchAll<Name extends StoreName<Schema>>(
		storeName: Name,
		options?: WatchAllOptions<Schema[Name]>,
	): Query<StoreValue<Schema[Name]>[]> {
		return this.#query(storeName, (operationOptions) => {
			const count = valueOf(options?.count);
			const query = valueOf(options?.query);

			return this.getAll(storeName, {
				...operationOptions,
				...(count !== undefined && { count }),
				...(query !== undefined && { query }),
			});
		});
	}

	/** Watches all matching primary keys and refreshes them after committed writes through this wrapper. */
	watchAllKeys<Name extends StoreName<Schema>>(
		storeName: Name,
		options?: WatchAllOptions<Schema[Name]>,
	): Query<StoreKey<Schema[Name]>[]> {
		return this.#query(storeName, (operationOptions) => {
			const count = valueOf(options?.count);
			const query = valueOf(options?.query);

			return this.getAllKeys(storeName, {
				...operationOptions,
				...(count !== undefined && { count }),
				...(query !== undefined && { query }),
			});
		});
	}

	/** Watches the matching record count and refreshes it after committed writes through this wrapper. */
	watchCount<Name extends StoreName<Schema>>(
		storeName: Name,
		options?: WatchCountOptions<Schema[Name]>,
	): Query<number> {
		return this.#query(storeName, (operationOptions) => {
			const query = valueOf(options?.query);

			return this.count(storeName, {
				...operationOptions,
				...(query !== undefined && { query }),
			});
		});
	}

	/** Disposes every query and closes the underlying database connection. */
	close(): void {
		const groups = [...this.#queries.values()];

		this.#queries.clear();

		for (const queries of groups) {
			for (const query of queries) {
				query.dispose();
			}
		}

		this.source.close();
	}

	/** Disposes all reactive queries and closes the underlying database connection. */
	[Symbol.dispose](): void {
		this.close();
	}

	#query<T>(storeName: StoreName<Schema>, read: (options?: DBOperationOptions) => Promise<T>): Query<T> {
		let queries = this.#queries.get(storeName);

		if (!queries) {
			this.#queries.set(storeName, (queries = new Set()));
		}

		let query: ReactiveQuery<T>;

		query = new ReactiveQuery(read, () => {
			queries.delete(query as ReactiveQuery<unknown>);
			if (queries.size === 0) {
				this.#queries.delete(storeName);
			}
		});

		queries.add(query as ReactiveQuery<unknown>);

		return query;
	}
}

function valueOf<T>(value: Watchable<T>): T;
function valueOf<T>(value: Watchable<T> | undefined): T | undefined;
function valueOf<T>(value: Watchable<T> | undefined): T | undefined {
	return Signal.isState(value) || Signal.isComputed(value) ? (value.get() as T) : value;
}

/** The latest pending, successful, or failed state of a reactive database query. */
export type QueryState<T> =
	| {
			/** Identifies a query waiting for its current database read. */
			readonly status: "pending";
	  }
	| {
			/** Identifies a query containing its latest successful result. */
			readonly status: "ready";

			/** The latest value returned by the database query. */
			readonly value: T;
	  }
	| {
			/** Identifies a query whose latest read failed or was cancelled. */
			readonly status: "error";

			/** The failure reported by the latest database read. */
			readonly error: unknown;
	  };

/** A read-only computed database query with explicit refresh and disposal controls. */
export type Query<T> = InstanceType<typeof Signal.Computed<QueryState<T>>> &
	Disposable & {
		/** Reruns the query and resolves after its latest requested result has been published. */
		refresh(options?: DBOperationOptions): Promise<void>;

		/** Stops reactive refreshes and settles any pending read with a disposal error. */
		dispose(): void;
	};

/** A static value or readable signal accepted by a reactive database query. */
export type Watchable<T> = T | AnySignal<T>;

/** Schema declarations used by {@link SignalDB}. */
export namespace SignalDB {
	/** Describes the values, primary keys, and optional indexes of one object store. */
	export interface Store<
		Value = unknown,
		Key extends IDBValidKey = IDBValidKey,
		Indexes extends Record<string, IDBValidKey> = never,
	> {
		/** The object store's primary-key type. */
		key: Key;

		/** The object store's stored-value type. */
		value: Value;

		/** Secondary index names and their corresponding key types. */
		indexes?: Indexes;
	}

	/** An unrestricted mapping of object-store names to their schema declarations. */
	export type Schema = Record<string, Store<unknown, IDBValidKey, Record<string, IDBValidKey>>>;
}

type StoreDefinition = SignalDB.Store<unknown, IDBValidKey, Record<string, IDBValidKey>>;
type SchemaDefinition<Schema> = { [Name in keyof Schema]: StoreDefinition };

/** Static or signal-backed filters for a reactive `watchAll()` or `watchAllKeys()` query. */
export interface WatchAllOptions<Store extends StoreDefinition> {
	/** The maximum number of matching records or keys to return. */
	readonly count?: Watchable<number | undefined>;

	/** The primary key or range used to filter matching records. */
	readonly query?: Watchable<StoreKey<Store> | IDBKeyRange | null | undefined>;
}

/** Static or signal-backed options for a reactive `watchCount()` query. */
export interface WatchCountOptions<Store extends StoreDefinition> {
	/** The primary key or range used to filter counted records. */
	readonly query?: Watchable<StoreKey<Store> | IDBKeyRange | null | undefined>;
}
