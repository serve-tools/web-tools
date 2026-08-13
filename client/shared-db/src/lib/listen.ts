import { DB, type DBOpenOptions } from "@serve-tools/client-db";
import { listen as listenForMessages } from "@serve-tools/client-messaging/scope/worker";
import { decodeQuery, isEncodedKeyRange } from "./.internals.js";
import type { SchemaDefinition, SharedDBChange, SharedDBEvent, SharedDBProtocol, SharedDBServer } from "./.types.js";

interface ChangeTarget<Schema extends SchemaDefinition<Schema>> {
	readonly emit: (change: SharedDBEvent<Schema>) => void;
	readonly storeNames: ReadonlySet<Extract<keyof Schema, string>>;
	pending: SharedDBChange<Schema>[] | undefined;
	ready: boolean;
}

/** Opens a database and serves its point operations to every port connected to the current `SharedWorker`. */
export const listen = <Schema extends SchemaDefinition<Schema> = DB.Schema>(
	name: string,
	options?: DBOpenOptions<Schema>,
): SharedDBServer<Schema> => {
	const subscribers = new Set<ChangeTarget<Schema>>();

	let revision = 0;
	let isClosed = false;

	const database = DB.open<Schema>(name, options);

	void database.catch(() => undefined);

	const emitChange = (change: SharedDBChange<Schema>): void => {
		for (const target of subscribers) {
			if (!target.storeNames.has(change.store)) {
				continue;
			}

			if (target.ready) {
				target.emit(change);
			} else {
				(target.pending ??= []).push(change);
			}
		}
	};

	const nextRevision = (): number => ++revision;
	const connections = listenForMessages<SharedDBProtocol<Schema>>({
		requests: {
			get: async ({ storeName, query }, { signal }) =>
				(await database).get(storeName, decodeQuery(query) as never, { signal }),

			getAll: async ({ storeName, options: operationOptions }, { signal }) =>
				(await database).getAll(storeName, {
					...operationOptions,
					query: decodeQuery(operationOptions?.query) as never,
					signal,
				}),

			getAllKeys: async ({ storeName, options: operationOptions }, { signal }) =>
				(await database).getAllKeys(storeName, {
					...operationOptions,
					query: decodeQuery(operationOptions?.query) as never,
					signal,
				}),

			has: async ({ storeName, query }, { signal }) =>
				(await database).has(storeName, decodeQuery(query) as never, { signal }),

			count: async ({ storeName, options: operationOptions }, { signal }) =>
				(await database).count(storeName, {
					...operationOptions,
					query: decodeQuery(operationOptions?.query) as never,
					signal,
				}),

			add: async ({ storeName, value, options: operationOptions }, { signal }) => {
				const key = await (await database).add(
					storeName,
					value as never,
					{
						...operationOptions,
						signal,
					} as never,
				);

				emitChange({
					kind: "added",
					store: storeName,
					key,
					value,
					revision: nextRevision(),
				} as SharedDBChange<Schema>);

				return key;
			},

			put: async ({ storeName, value, options: operationOptions }, { signal }) => {
				const key = await (await database).put(
					storeName,
					value as never,
					{
						...operationOptions,
						signal,
					} as never,
				);

				emitChange({
					kind: "invalidated",
					store: storeName,
					key,
					revision: nextRevision(),
				} as SharedDBChange<Schema>);

				return key;
			},

			delete: async ({ storeName, query, options: operationOptions }, { signal }) => {
				await (await database).delete(storeName, decodeQuery(query) as never, { ...operationOptions, signal });

				const revision = nextRevision();

				if (!isEncodedKeyRange(query)) {
					emitChange({ kind: "removed", store: storeName, key: query, revision } as SharedDBChange<Schema>);
				} else if (query.range === "only") {
					emitChange({
						kind: "removed",
						store: storeName,
						key: query.value,
						revision,
					} as SharedDBChange<Schema>);
				} else {
					emitChange({ kind: "invalidated", store: storeName, revision } as SharedDBChange<Schema>);
				}
			},

			clear: async ({ storeName, options: operationOptions }, { signal }) => {
				await (await database).clear(storeName, { ...operationOptions, signal });

				emitChange({
					kind: "invalidated",
					store: storeName,
					revision: nextRevision(),
				} as SharedDBChange<Schema>);
			},
		},

		subscriptions: {
			changes: async ({ storeNames }, { emit, signal }) => {
				const target: ChangeTarget<Schema> = {
					emit,
					pending: undefined,
					ready: false,
					storeNames: new Set(storeNames),
				};

				subscribers.add(target);

				try {
					await database;
				} catch (error) {
					subscribers.delete(target);

					throw error;
				}

				if (signal.aborted) {
					subscribers.delete(target);
					return;
				}

				emit({ kind: "ready", revision });

				target.ready = true;

				if (target.pending !== undefined) {
					for (const change of target.pending) {
						emit(change);
					}

					target.pending = undefined;
				}

				return () => subscribers.delete(target);
			},
		},
	});

	const close = (reason?: unknown): void => {
		if (isClosed) {
			return;
		}

		isClosed = true;

		connections.close(reason);
		subscribers.clear();

		void database.then(
			(value) => value.close(),
			() => undefined,
		);
	};

	return {
		database,
		close,
		[Symbol.dispose]: close,
	};
};
