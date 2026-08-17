/// <reference lib="dom" />
/// <reference lib="esnext.disposable" />

import type * as T from "../.types.js";
import { connect as connectPort } from "../connect.js";

export { RemoteError } from "@serve-tools/client-messaging";
export type * from "../.types.js";

export const connect = connectPort;

export namespace connect {
	export type Client<P extends T.Protocol = T.Protocol> = T.SharedWebTransportClient<P>;
	export type Datagrams<P extends T.Protocol> = T.SharedClientDatagrams<P>;
	export type Protocol = T.Protocol;
	export type ProtocolType<Value> = T.ProtocolType<Value>;
	export type RequestOptions = T.RequestOptions;
	export type SubscribeOptions = T.SubscribeOptions;
	export type Subscription = T.Subscription;
}
