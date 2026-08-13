/// <reference lib="dom" />
/// <reference lib="esnext.disposable" />

import type * as T from "../lib/.types.js";
import { connect as connectPort } from "../lib/connect.js";

export type {
	SchemaType,
	SharedDBChange,
	SharedDBClient,
	SharedDBServer,
	SharedDBSubscribeOptions,
	SharedDBSubscriber,
	SharedDBSubscription,
} from "../lib/.types.js";

/** Connects a typed database client to a port owned by a shared database worker. */
export const connect = connectPort;

/** Schema declarations available through {@link connect}. */
export namespace connect {
	/** Extracts the schema retained by a shared database server. */
	export type SchemaType<Value> = T.SchemaType<Value>;
}
