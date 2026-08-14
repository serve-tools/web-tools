/// <reference lib="esnext.disposable" />
/// <reference lib="webworker" />

import type {
	DB,
	DBCountOptions,
	DBGetAllOptions,
	DBMutationOptions,
	DBOperationOptions,
	DBWriteOptions,
	StoreKey,
	StoreName,
	StoreValue,
} from "@serve-tools/client-db";

declare const schemaBrand: unique symbol;

export type StoreDefinition = DB.Schema[string];
export type SchemaDefinition<Schema> = { [Name in keyof Schema]: StoreDefinition };

/** A committed database change delivered by a shared database subscription. */
export type SharedDBChange<
	Schema extends SchemaDefinition<Schema>,
	Names extends StoreName<Schema> = StoreName<Schema>,
> = {
	[Name in Names]:
		| {
				/** Identifies a newly added record. */
				readonly kind: "added";

				/** The object store containing the record. */
				readonly store: Name;

				/** The added record's primary key. */
				readonly key: StoreKey<Schema[Name]>;

				/** The value added to the object store. */
				readonly value: StoreValue<Schema[Name]>;

				/** The worker-lifetime revision assigned after commit. */
				readonly revision: number;
		  }
		| {
				/** Identifies a removed record. */
				readonly kind: "removed";

				/** The object store that contained the record. */
				readonly store: Name;

				/** The removed record's primary key. */
				readonly key: StoreKey<Schema[Name]>;

				/** The worker-lifetime revision assigned after commit. */
				readonly revision: number;
		  }
		| {
				/** Identifies a store or key whose current value must be queried again. */
				readonly kind: "invalidated";

				/** The invalidated object store. */
				readonly store: Name;

				/** The affected primary key, or `undefined` when the complete store was invalidated. */
				readonly key?: StoreKey<Schema[Name]>;

				/** The worker-lifetime revision assigned after commit. */
				readonly revision: number;
		  };
}[Names];

/** Receives every committed change for the stores selected by a subscription. */
export type SharedDBSubscriber<
	Schema extends SchemaDefinition<Schema>,
	Names extends StoreName<Schema> = StoreName<Schema>,
> = (change: SharedDBChange<Schema, Names>) => void;

/** Options for establishing and cancelling a shared database subscription. */
export interface SharedDBSubscribeOptions {
	/** Unsubscribes locally and cancels the corresponding worker operation. */
	readonly signal?: AbortSignal;

	/** Called after the database is open and the remote subscription is registered. */
	readonly onReady?: (revision: number) => void;

	/** Called when the remote subscription or its connection fails. */
	readonly onError?: (error: Error) => void;
}

/** A disposable handle for one shared database subscription. */
export interface SharedDBSubscription extends Disposable {
	/** Whether the subscription can still receive changes. */
	readonly active: boolean;

	/** Cancels the subscription. Calling it more than once has no effect. */
	unsubscribe(): void;
}

/** Typed point operations and committed changes provided by a shared database worker. */
export interface SharedDBClient<Schema extends SchemaDefinition<Schema> = DB.Schema> extends Disposable {
	/** Resolves after either peer closes the protocol connection. */
	readonly closed: Promise<void>;

	/** Returns the value for a primary key or range, or `undefined` when no record matches. */
	get<Name extends StoreName<Schema>>(
		storeName: Name,
		key: StoreKey<Schema[Name]> | IDBKeyRange,
		options?: DBOperationOptions,
	): Promise<StoreValue<Schema[Name]> | undefined>;

	/** Returns values matching an optional primary-key query. */
	getAll<Name extends StoreName<Schema>>(
		storeName: Name,
		options?: DBGetAllOptions<Schema[Name]>,
	): Promise<StoreValue<Schema[Name]>[]>;

	/** Returns primary keys matching an optional primary-key query. */
	getAllKeys<Name extends StoreName<Schema>>(
		storeName: Name,
		options?: DBGetAllOptions<Schema[Name]>,
	): Promise<StoreKey<Schema[Name]>[]>;

	/** Returns whether a primary key or range matches at least one record. */
	has<Name extends StoreName<Schema>>(
		storeName: Name,
		key: StoreKey<Schema[Name]> | IDBKeyRange,
		options?: DBOperationOptions,
	): Promise<boolean>;

	/** Counts records matching an optional primary-key query. */
	count<Name extends StoreName<Schema>>(storeName: Name, options?: DBCountOptions<Schema[Name]>): Promise<number>;

	/** Adds a record and resolves after its transaction commits. */
	add<Name extends StoreName<Schema>>(
		storeName: Name,
		value: StoreValue<Schema[Name]>,
		options?: DBWriteOptions<Schema[Name]>,
	): Promise<StoreKey<Schema[Name]>>;

	/** Adds or replaces a record and resolves after its transaction commits. */
	put<Name extends StoreName<Schema>>(
		storeName: Name,
		value: StoreValue<Schema[Name]>,
		options?: DBWriteOptions<Schema[Name]>,
	): Promise<StoreKey<Schema[Name]>>;

	/** Deletes records matching a primary key or range and resolves after commit. */
	delete<Name extends StoreName<Schema>>(
		storeName: Name,
		key: StoreKey<Schema[Name]> | IDBKeyRange,
		options?: DBMutationOptions,
	): Promise<void>;

	/** Removes every record from an object store and resolves after commit. */
	clear<Name extends StoreName<Schema>>(storeName: Name, options?: DBMutationOptions): Promise<void>;

	/** Delivers committed changes for one or more stores until cancelled or disconnected. */
	subscribe<const Names extends StoreName<Schema>>(
		storeNames: Names | readonly Names[],
		subscriber: SharedDBSubscriber<Schema, Names>,
		options?: SharedDBSubscribeOptions,
	): SharedDBSubscription;

	/** Closes the protocol connection without closing its underlying `MessagePort`. */
	close(reason?: unknown): void;
}

/** Owns one shared-worker database connection and the protocol servers attached to it. */
export interface SharedDBServer<Schema extends SchemaDefinition<Schema> = DB.Schema> extends Disposable {
	readonly [schemaBrand]?: Schema;

	/** The database opened and owned by this server. */
	readonly database: Promise<DB<Schema>>;

	/** Stops accepting ports, closes active protocol servers, and closes the database. */
	close(reason?: unknown): void;
}

/** Extracts the schema retained by a shared database server. */
export type SchemaType<Value> = Value extends SharedDBServer<infer Schema> ? Schema : never;

type AnyStore<Schema extends SchemaDefinition<Schema>> = Schema[StoreName<Schema>];
type AnyKey<Schema extends SchemaDefinition<Schema>> = StoreKey<AnyStore<Schema>>;
type AnyValue<Schema extends SchemaDefinition<Schema>> = StoreValue<AnyStore<Schema>>;

export type EncodedKeyRange =
	| { readonly range: "only"; readonly value: IDBValidKey }
	| { readonly range: "lower"; readonly lower: IDBValidKey; readonly open: boolean }
	| { readonly range: "upper"; readonly upper: IDBValidKey; readonly open: boolean }
	| {
			readonly range: "bound";
			readonly lower: IDBValidKey;
			readonly upper: IDBValidKey;
			readonly lowerOpen: boolean;
			readonly upperOpen: boolean;
	  };

export type EncodedQuery = IDBValidKey | EncodedKeyRange | null | undefined;
export type RemoteQueryOptions = { readonly count?: number; readonly query?: EncodedQuery };
export type RemoteMutationOptions = { readonly durability?: IDBTransactionDurability };
export type RemoteWriteOptions = RemoteMutationOptions & { readonly key?: IDBValidKey };
export type SharedDBEvent<Schema extends SchemaDefinition<Schema>> =
	| SharedDBChange<Schema>
	| { readonly kind: "ready"; readonly revision: number };

export type SharedDBProtocol<Schema extends SchemaDefinition<Schema>> = {
	requests: {
		get(input: {
			readonly storeName: StoreName<Schema>;
			readonly query: EncodedQuery;
		}): AnyValue<Schema> | undefined;
		getAll(input: {
			readonly storeName: StoreName<Schema>;
			readonly options: RemoteQueryOptions | undefined;
		}): AnyValue<Schema>[];
		getAllKeys(input: {
			readonly storeName: StoreName<Schema>;
			readonly options: RemoteQueryOptions | undefined;
		}): AnyKey<Schema>[];
		has(input: { readonly storeName: StoreName<Schema>; readonly query: EncodedQuery }): boolean;
		count(input: {
			readonly storeName: StoreName<Schema>;
			readonly options: RemoteQueryOptions | undefined;
		}): number;
		add(input: {
			readonly storeName: StoreName<Schema>;
			readonly value: AnyValue<Schema>;
			readonly options: RemoteWriteOptions | undefined;
		}): AnyKey<Schema>;
		put(input: {
			readonly storeName: StoreName<Schema>;
			readonly value: AnyValue<Schema>;
			readonly options: RemoteWriteOptions | undefined;
		}): AnyKey<Schema>;
		delete(input: {
			readonly storeName: StoreName<Schema>;
			readonly query: EncodedQuery;
			readonly options: RemoteMutationOptions | undefined;
		}): void;
		clear(input: {
			readonly storeName: StoreName<Schema>;
			readonly options: RemoteMutationOptions | undefined;
		}): void;
	};
	subscriptions: {
		changes(input: { readonly storeNames: readonly StoreName<Schema>[] }): SharedDBEvent<Schema>;
	};
};
