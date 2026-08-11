import type {
	DBCountOptions,
	DBGetAllOptions,
	DBMutationOptions,
	DBOperationOptions,
	DBWriteOptions,
} from "@serve-tools/client-db";
import type { WorkerRequestOptions } from "@serve-tools/client-messaging";
import type {
	EncodedKeyRange,
	EncodedQuery,
	RemoteMutationOptions,
	RemoteQueryOptions,
	RemoteWriteOptions,
	StoreDefinition,
} from "./.types.js";

export const encodeQuery = (query: IDBValidKey | IDBKeyRange | null | undefined): EncodedQuery => {
	if (!(query instanceof IDBKeyRange)) {
		return query;
	}

	const lower = query.lower as IDBValidKey | undefined;
	const upper = query.upper as IDBValidKey | undefined;

	if (lower === undefined) {
		return { range: "upper", upper: upper!, open: query.upperOpen };
	}

	if (upper === undefined) {
		return { range: "lower", lower, open: query.lowerOpen };
	}

	if (!query.lowerOpen && !query.upperOpen && indexedDB.cmp(lower, upper) === 0) {
		return { range: "only", value: lower };
	}

	return {
		range: "bound",
		lower,
		upper,
		lowerOpen: query.lowerOpen,
		upperOpen: query.upperOpen,
	};
};

export const isEncodedKeyRange = (query: EncodedQuery): query is EncodedKeyRange =>
	typeof query === "object" && query !== null && "range" in query;

export const decodeQuery = (query: EncodedQuery): IDBValidKey | IDBKeyRange | null | undefined => {
	if (!isEncodedKeyRange(query)) {
		return query;
	}

	switch (query.range) {
		case "only":
			return IDBKeyRange.only(query.value);
		case "lower":
			return IDBKeyRange.lowerBound(query.lower, query.open);
		case "upper":
			return IDBKeyRange.upperBound(query.upper, query.open);
		case "bound":
			return IDBKeyRange.bound(query.lower, query.upper, query.lowerOpen, query.upperOpen);
	}
};

export const requestOptions = (options?: DBOperationOptions): WorkerRequestOptions | undefined =>
	options?.signal === undefined ? undefined : { signal: options.signal };

export const queryOptions = (
	options?: DBGetAllOptions<StoreDefinition> | DBCountOptions<StoreDefinition>,
): RemoteQueryOptions | undefined =>
	options === undefined
		? undefined
		: {
				...(options.query === undefined ? {} : { query: encodeQuery(options.query) }),
				...("count" in options && options.count !== undefined ? { count: options.count } : {}),
			};

export const mutationOptions = (options?: DBMutationOptions): RemoteMutationOptions | undefined =>
	options?.durability === undefined ? undefined : { durability: options.durability };

export const writeOptions = (options?: DBWriteOptions<StoreDefinition>): RemoteWriteOptions | undefined =>
	options === undefined
		? undefined
		: {
				...(options.durability === undefined ? {} : { durability: options.durability }),
				...(options.key === undefined ? {} : { key: options.key }),
			};
