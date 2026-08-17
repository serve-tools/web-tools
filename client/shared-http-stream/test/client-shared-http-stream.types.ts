import type { ProtocolType, SharedHTTPStreamClient, SharedHTTPStreamServer } from "../src/client-shared-http-stream.js";
import { listen } from "../src/lib/scope/shared-worker.js";
import { connect } from "../src/lib/scope/window.js";

interface TestProtocol {
	requests: { echo(value: string): string };
	subscriptions: { ticks(start: number): number };
}

declare const port: MessagePort;

const client: SharedHTTPStreamClient<TestProtocol> = connect<TestProtocol>(port);
const server: SharedHTTPStreamServer<TestProtocol> = listen<TestProtocol>("https://example.test/realtime");
const echoed: Promise<string> = client.request("echo", "hello");
const subscription = client.subscribe("ticks", 1, (value) => value.toFixed());

type Equal<Left, Right> =
	(<Value>() => Value extends Left ? 1 : 2) extends <Value>() => Value extends Right ? 1 : 2 ? true : false;
type Expect<Value extends true> = Value;

export type ProtocolIsPreserved = [
	Expect<Equal<ProtocolType<typeof client>, TestProtocol>>,
	Expect<Equal<listen.ProtocolType<typeof server>, TestProtocol>>,
];

// @ts-expect-error request input must match the protocol
client.request("echo", 1);

void echoed;
void subscription;
void server;
