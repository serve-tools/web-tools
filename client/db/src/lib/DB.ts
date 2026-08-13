/// <reference lib="esnext.disposable" />

import { completed, completion, execute, exists, invoke, result } from "./.internals.js";
import type {
	DBCountOptions,
	DBDeleteOptions,
	DBEntry,
	DBGetAllOptions,
	DBMutationOptions,
	DBOpenOptions,
	DBOperationOptions,
	DBScanOptions,
	DBSchema,
	DBStore,
	DBTransactionCallback,
	DBTransaction as DBTransactionInterface,
	DBTransactionOptions,
	DBUpgradeDatabase,
	DBUpgradeTransaction,
	DBWriteOptions,
	Method,
	NativeTransaction,
	SchemaDefinition,
	StoreDefinition,
	StoreKey,
	StoreName,
	StoreValue,
} from "./.types.js";
import { DBTransaction } from "./DBTransaction.js";

/** A promise-based, typed IndexedDB connection. */
export class DB<Schema extends SchemaDefinition<Schema> = DBSchema> implements Disposable {
	readonly #source: IDBDatabase;

	private constructor(source: IDBDatabase) {
		this.#source = source;
	}

	/** Opens a connection and performs a synchronous schema upgrade when required. */
	static open<Schema extends SchemaDefinition<Schema> = DBSchema>(
		name: string,
		options?: DBOpenOptions<Schema>,
	): Promise<DB<Schema>> {
		const request = indexedDB.open(name, options?.version);
		const upgrade = options?.upgrade;

		if (upgrade) {
			request.onupgradeneeded = (event) =>
				upgrade(request.result as DBUpgradeDatabase<Schema>, {
					newVersion: event.newVersion,
					oldVersion: event.oldVersion,
					transaction: request.transaction as DBUpgradeTransaction<Schema>,
				});
		}

		const blocked = options?.blocked;

		if (blocked) {
			request.onblocked = blocked;
		}

		return result(request).then((source) => {
			const database = new DB<Schema>(source);
			const versionchange = options?.versionchange;
			const close = options?.close;

			source.onversionchange = versionchange ? (event) => versionchange(database, event) : () => database.close();

			if (close) {
				source.onclose = (event) => close(database, event);
			}

			return database;
		});
	}

	/** Deletes a database after all open connections allow the request to proceed. */
	static delete(name: string, options?: DBDeleteOptions): Promise<void> {
		const request = indexedDB.deleteDatabase(name);
		const blocked = options?.blocked;

		if (blocked) {
			request.onblocked = blocked;
		}

		return result(request as unknown as IDBRequest<void>);
	}

	/** Closes the underlying IndexedDB connection. */
	close(): void {
		this.#source.close();
	}

	/** Closes the connection when disposed. */
	[Symbol.dispose](): void {
		this.close();
	}

	/**
	 * Creates a transaction for one or more stores.
	 *
	 * With a callback, the promise resolves after commit and aborts the transaction when the callback throws.
	 * Without a callback, use the returned transaction's {@link DBTransaction.done | done} promise to observe completion.
	 */
	transaction<const Names extends StoreName<Schema>>(
		storeNames: Names | readonly Names[],
		options?: DBTransactionOptions,
	): DBTransactionInterface<Schema, Names>;

	transaction<const Names extends StoreName<Schema>, Result>(
		storeNames: Names | readonly Names[],
		options: DBTransactionOptions,
		callback: DBTransactionCallback<Schema, Names, Result>,
	): Promise<Awaited<Result>>;

	transaction<const Names extends StoreName<Schema>, Result>(
		storeNames: Names | readonly Names[],
		options?: DBTransactionOptions,
		callback?: DBTransactionCallback<Schema, Names, Result>,
	): DBTransactionInterface<Schema, Names> | Promise<Awaited<Result>> {
		const signal = options?.signal;

		if (callback && signal?.aborted) {
			return Promise.reject(signal.reason);
		}

		const source = this.#source.transaction(
			storeNames as string | string[],
			options?.mode,
			options,
		) as NativeTransaction<Schema, Names>;

		const transaction = new DBTransaction(source, signal);

		return callback ? execute(transaction, callback) : transaction;
	}

	/** Returns the value for a primary key, or `undefined` when no record matches. */
	get<Name extends StoreName<Schema>>(
		storeName: Name,
		key: StoreKey<Schema[Name]> | IDBKeyRange,
		options?: DBOperationOptions,
	): Promise<StoreValue<Schema[Name]> | undefined> {
		return this.#operation<StoreValue<Schema[Name]> | undefined>(storeName, options, "get", key);
	}

	/** Returns values matching an optional primary-key query after the read transaction commits. */
	getAll<Name extends StoreName<Schema>>(
		storeName: Name,
		options?: DBGetAllOptions<Schema[Name]>,
	): Promise<StoreValue<Schema[Name]>[]> {
		return this.#operation(storeName, options, "getAll", options?.query, options?.count);
	}

	/** Returns primary keys matching an optional query after the read transaction commits. */
	getAllKeys<Name extends StoreName<Schema>>(
		storeName: Name,
		options?: DBGetAllOptions<Schema[Name]>,
	): Promise<StoreKey<Schema[Name]>[]> {
		return this.#operation(storeName, options, "getAllKeys", options?.query, options?.count);
	}

	/** Returns whether a primary key or range matches at least one record. */
	has<Name extends StoreName<Schema>>(
		storeName: Name,
		key: StoreKey<Schema[Name]> | IDBKeyRange,
		options?: DBOperationOptions,
	): Promise<boolean> {
		return this.#operation<StoreKey<Schema[Name]> | undefined>(storeName, options, "getKey", key).then(exists);
	}

	/** Counts records matching an optional primary-key query. */
	count<Name extends StoreName<Schema>>(storeName: Name, options?: DBCountOptions<Schema[Name]>): Promise<number> {
		return this.#operation(storeName, options, "count", options?.query ?? undefined);
	}

	/** Adds a record in its own read/write transaction and resolves after commit. */
	add<Name extends StoreName<Schema>>(
		storeName: Name,
		value: StoreValue<Schema[Name]>,
		options?: DBWriteOptions<Schema[Name]>,
	): Promise<StoreKey<Schema[Name]>> {
		return this.#operation(storeName, options, "add", value, options?.key, true);
	}

	/** Adds or replaces a record in its own read/write transaction and resolves after commit. */
	put<Name extends StoreName<Schema>>(
		storeName: Name,
		value: StoreValue<Schema[Name]>,
		options?: DBWriteOptions<Schema[Name]>,
	): Promise<StoreKey<Schema[Name]>> {
		return this.#operation(storeName, options, "put", value, options?.key, true);
	}

	/** Deletes records matching a primary key or range in its own transaction. */
	delete<Name extends StoreName<Schema>>(
		storeName: Name,
		key: StoreKey<Schema[Name]> | IDBKeyRange,
		options?: DBMutationOptions,
	): Promise<void> {
		return this.#operation(storeName, options, "delete", key, undefined, true);
	}

	/** Removes every record from an object store in its own transaction. */
	clear<Name extends StoreName<Schema>>(storeName: Name, options?: DBMutationOptions): Promise<void> {
		return this.#operation(storeName, options, "clear", undefined, undefined, true);
	}

	/** Scans records in independently committed pages; writes between pages are observable. */
	scan<Name extends StoreName<Schema>>(
		storeName: Name,
		options?: DBScanOptions<Schema[Name]>,
	): AsyncGenerator<DBEntry<Schema[Name]>, void, undefined> {
		return this.#scan(storeName, options) as AsyncGenerator<DBEntry<Schema[Name]>, void, undefined>;
	}

	/** Scans keys in independently committed pages. */
	scanKeys<Name extends StoreName<Schema>>(
		storeName: Name,
		options?: DBScanOptions<Schema[Name]>,
	): AsyncGenerator<StoreKey<Schema[Name]>, void, undefined> {
		return this.#scan(storeName, options, "key") as AsyncGenerator<StoreKey<Schema[Name]>, void, undefined>;
	}

	/** Scans values in independently committed pages. */
	scanValues<Name extends StoreName<Schema>>(
		storeName: Name,
		options?: DBScanOptions<Schema[Name]>,
	): AsyncGenerator<StoreValue<Schema[Name]>, void, undefined> {
		return this.#scan(storeName, options, "value") as AsyncGenerator<StoreValue<Schema[Name]>, void, undefined>;
	}

	#operation<Result>(
		storeName: StoreName<Schema>,
		options: (DBOperationOptions & IDBTransactionOptions) | undefined,
		method: Method,
		value: unknown,
		keyOrCount?: IDBValidKey | number,
		write?: boolean,
	): Promise<Result> {
		const signal = options?.signal;

		if (signal?.aborted) {
			return Promise.reject(signal.reason);
		}

		const transaction = this.#source.transaction(storeName, write ? "readwrite" : undefined, options);

		return completed(invoke<Result>(transaction.objectStore(storeName), method, value, keyOrCount), signal);
	}

	async *#scan(
		storeName: StoreName<Schema>,
		options: DBScanOptions<StoreDefinition> | undefined,
		output?: "key" | "value",
	): AsyncGenerator<unknown, void, undefined> {
		const direction = options?.direction ?? "next";
		const size = Math.max(1, options?.batchSize ?? 100);
		const signal = options?.signal;
		const keysOnly = output === "key";
		const initialQuery = options?.query;

		let query =
			initialQuery == null
				? undefined
				: initialQuery instanceof IDBKeyRange
					? initialQuery
					: IDBKeyRange.only(initialQuery);
		let remaining = options?.limit ?? Infinity;

		while (remaining > 0) {
			signal?.throwIfAborted();

			const requested = Math.min(size, remaining);
			const transaction = this.#source.transaction(storeName);
			const store = transaction.objectStore(storeName);
			const count = Number.isFinite(requested) ? requested : undefined;

			let keys: IDBValidKey[];
			let values: unknown[] | undefined;

			if (direction === "next") {
				const keyRequest = store.getAllKeys(query ?? null, count);
				const valueRequest = keysOnly ? undefined : store.getAll(query ?? null, count);

				keys = await completed(keyRequest, signal);
				values = valueRequest?.result;
			} else {
				keys = [];
				values = keysOnly ? undefined : [];

				const request: IDBRequest<IDBCursor | null> | IDBRequest<IDBCursorWithValue | null> = values
					? store.openCursor(query ?? null, "prev")
					: store.openKeyCursor(query ?? null, "prev");

				request.onsuccess = () => {
					const cursor = request.result;

					if (!cursor) {
						return;
					}

					keys.push(cursor.primaryKey);
					values?.push((cursor as IDBCursorWithValue).value);

					if (keys.length < requested) {
						cursor.continue();
					}
				};

				await completion(transaction, signal);
			}

			for (let index = 0; index < keys.length; ++index) {
				yield keysOnly ? keys[index] : output ? values![index] : { key: keys[index]!, value: values![index] };
			}

			if (keys.length < requested) {
				return;
			}

			remaining -= keys.length;

			if (remaining === 0) {
				return;
			}

			const last = keys[keys.length - 1]!;
			const next =
				direction === "next"
					? query?.upper === undefined
						? IDBKeyRange.lowerBound(last, true)
						: indexedDB.cmp(last, query.upper) < 0
							? IDBKeyRange.bound(last, query.upper, true, query.upperOpen)
							: undefined
					: query?.lower === undefined
						? IDBKeyRange.upperBound(last, true)
						: indexedDB.cmp(last, query.lower) > 0
							? IDBKeyRange.bound(query.lower, last, query.lowerOpen, true)
							: undefined;

			if (!next) {
				return;
			}

			query = next;
		}
	}
}

/** Schema declarations used by {@link DB}. */
export namespace DB {
	/** Declares the value, primary-key, and index-key types of one object store. */
	export interface Store<
		Value = unknown,
		Key extends IDBValidKey = IDBValidKey,
		Indexes extends Record<string, IDBValidKey> = never,
	> extends DBStore<Value, Key, Indexes> {}

	/** An unrestricted database schema. */
	export type Schema = DBSchema;
}
