/// <reference lib="esnext.disposable" preserve="true" />

import {
	connect as connectSharedDB,
	type SharedDBClient,
	type SharedDBSubscription,
} from "@serve-tools/client-shared-db/scope/window";
import { type AnySignal, Signal } from "@serve-tools/signal";
import { createEffect } from "@serve-tools/signal-effect";

export type {
	SharedDBChange,
	SharedDBClient,
	SharedDBSubscribeOptions,
	SharedDBSubscriber,
	SharedDBSubscription,
} from "@serve-tools/client-shared-db/scope/window";

const pending = { status: "pending" } as const;
const Computed = Signal.Computed;

class ReactiveQuery<T> extends Computed<QueryState<T>> implements Query<T> {
	readonly #fail: (error: unknown) => void;
	readonly #invalidate: () => void;
	readonly #refresh: (options?: OperationOptions) => Promise<void>;
	readonly #stop: () => void;

	constructor(
		read: (ready: Promise<void>, options?: OperationOptions) => Promise<T>,
		groupReady: Promise<void>,
		onDispose: () => void,
	) {
		const state = new Signal.State<QueryState<T>>(pending);

		super(() => state.get());

		const invalidation = new Signal.State(0);

		let current = Promise.resolve();
		let disposed = false;
		let generation = 0;
		const disposedReady = Promise.withResolvers<never>();
		const ready = Promise.race([groupReady, disposedReady.promise]);

		const fail = (error: unknown) => {
			if (disposed) return;

			++generation;

			current = Promise.resolve();

			state.set({ status: "error", error });
		};

		const refresh = (options?: OperationOptions): Promise<void> => {
			if (disposed) {
				return Promise.reject(new DOMException("Query is disposed", "InvalidStateError"));
			}

			const request = ++generation;

			let result: Promise<QueryState<T>>;

			state.set(pending);

			try {
				result = read(ready, options).then<QueryState<T>, QueryState<T>>(
					(value) => ({ status: "ready", value }),
					(error: unknown) => ({ status: "error", error }),
				);
			} catch (error) {
				result = Promise.resolve({ status: "error", error });
			}

			current = result.then((nextState) => {
				if (request !== generation) return current;

				state.set(nextState);
			});

			return current;
		};

		const controller = createEffect(() => {
			invalidation.get();
			void refresh();
		});

		this.#fail = fail;
		this.#invalidate = () => invalidation.set(invalidation.get() + 1);
		this.#refresh = refresh;
		this.#stop = () => {
			if (disposed) {
				return;
			}

			disposed = true;

			disposedReady.reject(new DOMException("Query is disposed", "InvalidStateError"));

			controller.dispose();

			onDispose();
		};

		controller.start();
	}

	fail(error: unknown): void {
		this.#fail(error);
	}

	invalidate(): void {
		this.#invalidate();
	}

	refresh(options?: OperationOptions): Promise<void> {
		return this.#refresh(options);
	}

	dispose(): void {
		this.#stop();
	}

	[Symbol.dispose](): void {
		this.dispose();
	}
}

/** A typed shared database client with signal-backed reactive queries. */
export class SignalDB<Schema extends SchemaDefinition<Schema> = SignalDB.Schema> implements Disposable {
	readonly #queryGroups = new Map<StoreName<Schema>, QueryGroup>();

	/** Wraps an existing shared database client and owns the reactive queries created through it. */
	constructor(
		/** The underlying point-operation and change-subscription client. */
		readonly source: SharedDBClient<Schema>,
	) {
		void source.closed.then(() => this.#disposeQueries());
	}

	/** Returns the value for a primary key or range, or `undefined` when no record matches. */
	get<Name extends StoreName<Schema>>(
		storeName: Name,
		key: StoreKey<Schema[Name]> | IDBKeyRange,
		options?: OperationOptions,
	): Promise<StoreValue<Schema[Name]> | undefined> {
		return this.source.get(storeName, key, options);
	}

	/** Returns values matching an optional primary-key query. */
	getAll<Name extends StoreName<Schema>>(
		storeName: Name,
		options?: GetAllOptions<Schema[Name]>,
	): Promise<StoreValue<Schema[Name]>[]> {
		return this.source.getAll(storeName, options);
	}

	/** Returns primary keys matching an optional primary-key query. */
	getAllKeys<Name extends StoreName<Schema>>(
		storeName: Name,
		options?: GetAllOptions<Schema[Name]>,
	): Promise<StoreKey<Schema[Name]>[]> {
		return this.source.getAllKeys(storeName, options);
	}

	/** Returns whether a primary key or range matches at least one record. */
	has<Name extends StoreName<Schema>>(
		storeName: Name,
		key: StoreKey<Schema[Name]> | IDBKeyRange,
		options?: OperationOptions,
	): Promise<boolean> {
		return this.source.has(storeName, key, options);
	}

	/** Counts records matching an optional primary-key query. */
	count<Name extends StoreName<Schema>>(storeName: Name, options?: CountOptions<Schema[Name]>): Promise<number> {
		return this.source.count(storeName, options);
	}

	/** Adds a record and resolves after its transaction commits. */
	add<Name extends StoreName<Schema>>(
		storeName: Name,
		value: StoreValue<Schema[Name]>,
		options?: WriteOptions<Schema[Name]>,
	): Promise<StoreKey<Schema[Name]>> {
		return this.source.add(storeName, value, options);
	}

	/** Adds or replaces a record and resolves after its transaction commits. */
	put<Name extends StoreName<Schema>>(
		storeName: Name,
		value: StoreValue<Schema[Name]>,
		options?: WriteOptions<Schema[Name]>,
	): Promise<StoreKey<Schema[Name]>> {
		return this.source.put(storeName, value, options);
	}

	/** Deletes records matching a primary key or range and resolves after commit. */
	delete<Name extends StoreName<Schema>>(
		storeName: Name,
		key: StoreKey<Schema[Name]> | IDBKeyRange,
		options?: MutationOptions,
	): Promise<void> {
		return this.source.delete(storeName, key, options);
	}

	/** Removes every record from an object store and resolves after commit. */
	clear<Name extends StoreName<Schema>>(storeName: Name, options?: MutationOptions): Promise<void> {
		return this.source.clear(storeName, options);
	}

	/** Refreshes every active query for one or more stores. */
	invalidate<const Names extends StoreName<Schema>>(storeNames: Names | readonly Names[]): void {
		const names = typeof storeNames === "string" ? [storeNames] : storeNames;

		for (const storeName of names) {
			for (const query of this.#queryGroups.get(storeName)?.queries ?? []) query.invalidate();
		}
	}

	/** Watches one record and refreshes it after committed changes to its store. */
	watch<Name extends StoreName<Schema>>(
		storeName: Name,
		key: Watchable<StoreKey<Schema[Name]> | IDBKeyRange>,
	): Query<StoreValue<Schema[Name]> | undefined> {
		return this.#query(storeName, (ready, options) => {
			const currentKey = valueOf(key);

			return ready.then(() => this.get(storeName, currentKey, options));
		});
	}

	/** Watches all matching records and refreshes them after committed changes to their store. */
	watchAll<Name extends StoreName<Schema>>(
		storeName: Name,
		options?: WatchAllOptions<Schema[Name]>,
	): Query<StoreValue<Schema[Name]>[]> {
		return this.#query(storeName, (ready, operationOptions) => {
			const count = valueOf(options?.count);
			const query = valueOf(options?.query);
			const getAllOptions = {
				...operationOptions,
				...(count === undefined ? {} : { count }),
				...(query === undefined ? {} : { query }),
			};

			return ready.then(() => this.getAll(storeName, getAllOptions));
		});
	}

	/** Disposes every query and closes the underlying protocol connection without closing its `MessagePort`. */
	close(reason?: unknown): void {
		this.#disposeQueries();
		this.source.close(reason);
	}

	/** Closes the reactive database. */
	dispose(): void {
		this.close();
	}

	/** Closes the reactive database through explicit resource management. */
	[Symbol.dispose](): void {
		this.dispose();
	}

	#disposeQueries(): void {
		const groups = [...this.#queryGroups.values()];

		this.#queryGroups.clear();

		for (const group of groups) {
			group.subscription.unsubscribe();

			for (const query of group.queries) query.dispose();
		}
	}

	#query<T>(
		storeName: StoreName<Schema>,
		read: (ready: Promise<void>, options?: OperationOptions) => Promise<T>,
	): Query<T> {
		let group = this.#queryGroups.get(storeName);

		if (group === undefined) {
			const queries = new Set<ReactiveQuery<unknown>>();
			const ready = Promise.withResolvers<void>();
			const subscription = this.source.subscribe(
				storeName,
				() => {
					for (const query of queries) query.invalidate();
				},
				{
					onReady: () => ready.resolve(),
					onError: (error) => {
						ready.reject(error);

						for (const query of queries) query.fail(error);
					},
				},
			);

			group = { queries, ready: ready.promise, subscription };

			this.#queryGroups.set(storeName, group);
		}

		let query: ReactiveQuery<T>;

		query = new ReactiveQuery(read, group.ready, () => {
			group.queries.delete(query as ReactiveQuery<unknown>);

			if (group.queries.size === 0 && this.#queryGroups.delete(storeName)) {
				group.subscription.unsubscribe();
			}
		});

		group.queries.add(query as ReactiveQuery<unknown>);

		return query;
	}

	/** Connects a reactive database to a port owned by a shared database worker. */
	static connect<Schema extends SchemaDefinition<Schema> = SignalDB.Schema>(port: MessagePort): SignalDB<Schema> {
		return new this<Schema>(connectSharedDB<Schema>(port));
	}
}

function valueOf<T>(value: Watchable<T>): T;
function valueOf<T>(value: Watchable<T> | undefined): T | undefined;
function valueOf<T>(value: Watchable<T> | undefined): T | undefined {
	return Signal.isState(value) || Signal.isComputed(value) ? (value.get() as T) : value;
}

/** The observable state of a shared database query. */
export type QueryState<T> =
	| {
			/** Identifies a query whose latest requested read has not published. */
			readonly status: "pending";
	  }
	| {
			/** Identifies a query containing its latest successfully read value. */
			readonly status: "ready";

			/** The latest value read by the query. */
			readonly value: T;
	  }
	| {
			/** Identifies a query whose latest read failed or was cancelled. */
			readonly status: "error";

			/** The read, connection, or cancellation failure. */
			readonly error: unknown;
	  };

/** A computed query that can be refreshed or disconnected from its dependencies. */
export type Query<T> = InstanceType<typeof Signal.Computed<QueryState<T>>> &
	Disposable & {
		/** Runs the query again and resolves once the latest requested state has been published. */
		refresh(options?: OperationOptions): Promise<void>;

		/** Stops automatic refreshes. An in-flight request may still settle. */
		dispose(): void;
	};

/** A static value or readable signal. */
export type Watchable<T> = T | AnySignal<T>;

/** Schema declarations used by {@link SignalDB}. */
export namespace SignalDB {
	/** Declares the value, primary-key, and index-key types of one object store. */
	export interface Store<
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

	/** An unrestricted schema of string-named object stores. */
	export type Schema = Record<string, Store<unknown, IDBValidKey, Record<string, IDBValidKey>>>;
}

type StoreDefinition = SignalDB.Store<unknown, IDBValidKey, Record<string, IDBValidKey>>;
type SchemaDefinition<Schema> = { [Name in keyof Schema]: StoreDefinition };

interface QueryGroup {
	readonly queries: Set<ReactiveQuery<unknown>>;
	readonly ready: Promise<void>;
	readonly subscription: SharedDBSubscription;
}

/** The string names of object stores declared by a schema. */
export type StoreName<Schema> = Extract<keyof Schema, string>;

/** The primary-key type declared by an object store. */
export type StoreKey<Store extends StoreDefinition> = Store["key"];

/** The structured-clone value type declared by an object store. */
export type StoreValue<Store extends StoreDefinition> = Store["value"];

/** Options shared by cancellable point operations and query refreshes. */
export interface OperationOptions {
	/** Rejects a point operation, or publishes an error state for a query refresh, when aborted. */
	signal?: AbortSignal;
}

/** Options for a standalone database mutation. */
export interface MutationOptions extends OperationOptions, IDBTransactionOptions {}

/** Options for adding or replacing one record. */
export interface WriteOptions<Store extends StoreDefinition> extends MutationOptions {
	/** An explicit primary key for stores without an inline key path. */
	key?: StoreKey<Store>;
}

/** Options for a finite `getAll` or `getAllKeys` operation. */
export interface GetAllOptions<Store extends StoreDefinition> extends OperationOptions {
	/** The maximum number of matching records to return. */
	count?: number;

	/** A primary key, key range, or `null` to match every record. */
	query?: StoreKey<Store> | IDBKeyRange | null;
}

/** Options for a finite count operation. */
export interface CountOptions<Store extends StoreDefinition> extends OperationOptions {
	/** A primary key, key range, or `null` to count every record. */
	query?: StoreKey<Store> | IDBKeyRange | null;
}

/** Static or signal-backed options for a reactive `watchAll()` query. */
export interface WatchAllOptions<Store extends StoreDefinition> {
	/** The static or reactive maximum number of matching records. */
	count?: Watchable<number | undefined>;

	/** The static or reactive primary-key query. */
	query?: Watchable<StoreKey<Store> | IDBKeyRange | null | undefined>;
}
