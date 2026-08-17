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
const Computed = Signal.Computed;

class ReactiveQuery<T> extends Computed<QueryState<T>> implements Query<T> {
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

		const refresh = (options?: DBOperationOptions): Promise<void> => {
			if (disposed) {
				return Promise.reject(new DOMException("Query is disposed", "InvalidStateError"));
			}

			const request = ++generation;
			let result: Promise<QueryState<T>>;

			state.set(pending);

			try {
				result = read(options).then<QueryState<T>, QueryState<T>>(
					(value) => ({ status: "ready", value }),
					(error: unknown) => ({ status: "error", error }),
				);
			} catch (error) {
				result = Promise.resolve({ status: "error", error });
			}

			let next: Promise<void>;

			next = result.then((nextState) => {
				if (request !== generation) {
					return current === next ? undefined : current;
				}

				state.set(nextState);
			});
			current = next;

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
			++generation;
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
	constructor(readonly source: DB<Schema>) {}

	/** Opens a database and wraps it with signal-backed queries. */
	static async open<Schema extends SchemaDefinition<Schema> = SignalDB.Schema>(
		name: string,
		options?: DBOpenOptions<Schema>,
	): Promise<SignalDB<Schema>> {
		return new this<Schema>(await DB.open<Schema>(name, options));
	}

	get<Name extends StoreName<Schema>>(
		storeName: Name,
		key: StoreKey<Schema[Name]> | IDBKeyRange,
		options?: DBOperationOptions,
	): Promise<StoreValue<Schema[Name]> | undefined> {
		return this.source.get(storeName, key, options);
	}

	getAll<Name extends StoreName<Schema>>(
		storeName: Name,
		options?: DBGetAllOptions<Schema[Name]>,
	): Promise<StoreValue<Schema[Name]>[]> {
		return this.source.getAll(storeName, options);
	}

	getAllKeys<Name extends StoreName<Schema>>(
		storeName: Name,
		options?: DBGetAllOptions<Schema[Name]>,
	): Promise<StoreKey<Schema[Name]>[]> {
		return this.source.getAllKeys(storeName, options);
	}

	has<Name extends StoreName<Schema>>(
		storeName: Name,
		key: StoreKey<Schema[Name]> | IDBKeyRange,
		options?: DBOperationOptions,
	): Promise<boolean> {
		return this.source.has(storeName, key, options);
	}

	count<Name extends StoreName<Schema>>(storeName: Name, options?: DBCountOptions<Schema[Name]>): Promise<number> {
		return this.source.count(storeName, options);
	}

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

	delete<Name extends StoreName<Schema>>(
		storeName: Name,
		key: StoreKey<Schema[Name]> | IDBKeyRange,
		options?: DBMutationOptions,
	): Promise<void> {
		return this.source.delete(storeName, key, options).then(() => this.invalidate(storeName));
	}

	clear<Name extends StoreName<Schema>>(storeName: Name, options?: DBMutationOptions): Promise<void> {
		return this.source.clear(storeName, options).then(() => this.invalidate(storeName));
	}

	transaction<const Names extends StoreName<Schema>>(
		storeNames: Names | readonly Names[],
		options?: DBTransactionOptions,
	): DBTransaction<Schema, Names>;

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

	scan<Name extends StoreName<Schema>>(
		storeName: Name,
		options?: DBScanOptions<Schema[Name]>,
	): AsyncGenerator<DBEntry<Schema[Name]>, void, undefined> {
		return this.source.scan(storeName, options);
	}

	scanKeys<Name extends StoreName<Schema>>(
		storeName: Name,
		options?: DBScanOptions<Schema[Name]>,
	): AsyncGenerator<StoreKey<Schema[Name]>, void, undefined> {
		return this.source.scanKeys(storeName, options);
	}

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
				...(count === undefined ? {} : { count }),
				...(query === undefined ? {} : { query }),
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

export type QueryState<T> =
	| { readonly status: "pending" }
	| { readonly status: "ready"; readonly value: T }
	| { readonly status: "error"; readonly error: unknown };

export type Query<T> = InstanceType<typeof Signal.Computed<QueryState<T>>> &
	Disposable & {
		refresh(options?: DBOperationOptions): Promise<void>;
		dispose(): void;
	};

export type Watchable<T> = T | AnySignal<T>;

export namespace SignalDB {
	export interface Store<
		Value = unknown,
		Key extends IDBValidKey = IDBValidKey,
		Indexes extends Record<string, IDBValidKey> = never,
	> {
		key: Key;
		value: Value;
		indexes?: Indexes;
	}
	export type Schema = Record<string, Store<unknown, IDBValidKey, Record<string, IDBValidKey>>>;
}

type StoreDefinition = SignalDB.Store<unknown, IDBValidKey, Record<string, IDBValidKey>>;
type SchemaDefinition<Schema> = { [Name in keyof Schema]: StoreDefinition };

export interface WatchAllOptions<Store extends StoreDefinition> {
	readonly count?: Watchable<number | undefined>;
	readonly query?: Watchable<StoreKey<Store> | IDBKeyRange | null | undefined>;
}
