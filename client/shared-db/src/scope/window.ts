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

export const connect = connectPort;

export namespace connect {
	/** Extracts the schema retained by a shared database server. */
	export type SchemaType<Value> = T.SchemaType<Value>;
}
