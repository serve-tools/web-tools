/// <reference lib="esnext.disposable" />

import type { ProtocolType, SharedWebSocketClient, SharedWebSocketServer } from "../src/client-shared-websocket.js";
import { listen } from "../src/lib/scope/shared-worker.js";
import { connect } from "../src/lib/scope/window.js";

interface TestProtocol {
	requests: {
		echo(value: string): string;
		status(): { online: boolean };
	};
	subscriptions: {
		ticks(start: number): number;
	};
}

declare const port: MessagePort;

const client: SharedWebSocketClient<TestProtocol> = connect<TestProtocol>(port);
const server: SharedWebSocketServer<TestProtocol> = listen<TestProtocol>("wss://example.test/socket");
const echoed: Promise<string> = client.request("echo", "hello");
const subscription = client.subscribe("ticks", 1, (value) => value.toFixed());

type Equal<Left, Right> =
	(<Value>() => Value extends Left ? 1 : 2) extends <Value>() => Value extends Right ? 1 : 2 ? true : false;
type Expect<Value extends true> = Value;

export type ProtocolIsPreserved = [
	Expect<Equal<ProtocolType<typeof client>, TestProtocol>>,
	Expect<Equal<listen.ProtocolType<typeof server>, TestProtocol>>,
];

// @ts-expect-error unknown request
client.request("missing");
// @ts-expect-error request input must match the protocol
client.request("echo", 1);
// @ts-expect-error subscription input must match the protocol
client.subscribe("ticks", "1", () => {});

void echoed;
void subscription;
void server;
