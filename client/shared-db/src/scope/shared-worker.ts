/// <reference lib="esnext.disposable" />
/// <reference lib="webworker" />

import type * as T from "../lib/.types.js";
import { listen as listenForDatabase } from "../lib/listen.js";

export type {
	SchemaType,
	SharedDBChange,
	SharedDBClient,
	SharedDBServer,
	SharedDBSubscribeOptions,
	SharedDBSubscriber,
	SharedDBSubscription,
} from "../lib/.types.js";

export const listen = listenForDatabase;

export namespace listen {
	/** Extracts the schema retained by a shared database server. */
	export type SchemaType<Value> = T.SchemaType<Value>;
}
