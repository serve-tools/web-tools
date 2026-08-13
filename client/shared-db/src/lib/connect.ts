import type { DB, DBCountOptions, DBGetAllOptions, DBWriteOptions, StoreKey, StoreValue } from "@serve-tools/client-db";
import { connect as connectPort } from "@serve-tools/client-messaging";
import { encodeQuery, mutationOptions, queryOptions, requestOptions, writeOptions } from "./.internals.js";
import type {
	SchemaDefinition,
	SharedDBClient,
	SharedDBProtocol,
	SharedDBSubscriber,
	SharedDBSubscription,
	StoreDefinition,
} from "./.types.js";

/** Connects a typed database client to a port owned by a `SharedWorker`. */
export const connect = <Schema extends SchemaDefinition<Schema> = DB.Schema>(
	port: MessagePort,
): SharedDBClient<Schema> => {
	const client = connectPort<SharedDBProtocol<Schema>>(port);

	return {
		closed: client.closed,

		get: (storeName, key, options) =>
			client.request("get", { storeName, query: encodeQuery(key) }, requestOptions(options)) as Promise<
				StoreValue<Schema[typeof storeName]> | undefined
			>,

		getAll: (storeName, options) =>
			client.request(
				"getAll",
				{ storeName, options: queryOptions(options as DBGetAllOptions<StoreDefinition>) },
				requestOptions(options),
			) as Promise<StoreValue<Schema[typeof storeName]>[]>,

		getAllKeys: (storeName, options) =>
			client.request(
				"getAllKeys",
				{ storeName, options: queryOptions(options as DBGetAllOptions<StoreDefinition>) },
				requestOptions(options),
			) as Promise<StoreKey<Schema[typeof storeName]>[]>,

		has: (storeName, key, options) =>
			client.request("has", { storeName, query: encodeQuery(key) }, requestOptions(options)),

		count: (storeName, options) =>
			client.request(
				"count",
				{ storeName, options: queryOptions(options as DBCountOptions<StoreDefinition>) },
				requestOptions(options),
			),

		add: (storeName, value, options) =>
			client.request(
				"add",
				{
					storeName,
					value,
					options: writeOptions(options as DBWriteOptions<StoreDefinition>),
				},
				requestOptions(options),
			) as Promise<StoreKey<Schema[typeof storeName]>>,

		put: (storeName, value, options) =>
			client.request(
				"put",
				{
					storeName,
					value,
					options: writeOptions(options as DBWriteOptions<StoreDefinition>),
				},
				requestOptions(options),
			) as Promise<StoreKey<Schema[typeof storeName]>>,

		delete: (storeName, key, options) =>
			client.request(
				"delete",
				{ storeName, query: encodeQuery(key), options: mutationOptions(options) },
				requestOptions(options),
			),

		clear: (storeName, options) =>
			client.request("clear", { storeName, options: mutationOptions(options) }, requestOptions(options)),

		subscribe(storeNames, subscriber, options): SharedDBSubscription {
			const names = typeof storeNames === "string" ? [storeNames] : storeNames;
			const workerOptions = {
				...(options?.signal === undefined ? {} : { signal: options.signal }),
				...(options?.onError === undefined ? {} : { onError: options.onError }),
			};

			return client.subscribe(
				"changes",
				{ storeNames: names },
				(event) => {
					if (event.kind === "ready") {
						options?.onReady?.(event.revision);
					} else {
						(subscriber as SharedDBSubscriber<Schema>)(event);
					}
				},
				workerOptions,
			);
		},

		close: client.close,
		[Symbol.dispose]: client[Symbol.dispose],
	} as SharedDBClient<Schema>;
};
