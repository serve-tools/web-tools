import type { Protocol, ProtocolDefinition } from "@serve-tools/realtime-protocol";
import { subprotocol } from "@serve-tools/realtime-protocol";
import { createSession } from "../lib/session.js";
import type * as T from "../lib/types.js";
import type { Awaitable, DatagramWritableOptions, Handlers, Session, SessionOptions } from "../lib/types.js";

const operationsRole = 0;
const datagramsRole = 1;

export interface NodeWebTransportSessionLike {
	readonly headers: Readonly<Record<string, string | readonly string[] | undefined>>;
	readonly path: string;
	sendDatagram(data: Uint8Array): boolean;
}

export interface NodeWebTransportStreamLike {
	readonly session: NodeWebTransportSessionLike;
	send(data: Uint8Array, options?: { readonly fin?: boolean }): boolean;
	close(data?: Uint8Array): boolean;
}

export interface NodeAdapterOptions<Context = undefined> extends SessionOptions {
	readonly authorize?: (session: NodeWebTransportSessionLike) => Awaitable<Context | Response>;
}

export interface NodeHandlers {
	session(session: NodeWebTransportSessionLike): Promise<Response | false>;
	datagram(session: NodeWebTransportSessionLike, data: Uint8Array): void;
	webTransportStream(stream: NodeWebTransportStreamLike): void;
	webTransportData(stream: NodeWebTransportStreamLike, data: Uint8Array): void;
	webTransportStreamEnd(stream: NodeWebTransportStreamLike, reason: "finished" | "aborted", errorCode?: number): void;
}

export interface NodeAdapter extends NodeHandlers, Disposable {
	close(reason?: unknown): void;
}

interface State<P extends Protocol, Context> {
	readonly session: Session<P, Context>;
	operations?: NodeWebTransportStreamLike;
	registry?: NodeWebTransportStreamLike;
}

/** Creates callbacks for `@http3-server/server` WebTransport handlers. */
export function createNodeAdapter<const P extends Protocol & ProtocolDefinition<P>, Context = undefined>(
	handlers: Handlers<P, Context>,
	options: NodeAdapterOptions<Context> = {},
): NodeAdapter {
	const sessions = new Map<NodeWebTransportSessionLike, State<P, Context>>();
	const streams = new Map<NodeWebTransportStreamLike, { readonly state: State<P, Context>; role?: number }>();
	let isClosed = false;

	const adapter: NodeAdapter = {
		async session(nativeSession) {
			if (isClosed) {
				return new Response("Service Unavailable", { status: 503 });
			}

			if (!availableProtocols(nativeSession.headers["wt-available-protocols"]).includes(subprotocol)) {
				return new Response("WebTransport Protocol Required", { status: 400 });
			}

			let result: Context | Response;

			try {
				result = options.authorize ? await options.authorize(nativeSession) : (undefined as Context);
			} catch (error) {
				options.reportError?.(error);

				return error instanceof Response ? error : new Response("Internal Server Error", { status: 500 });
			}

			if (result instanceof Response) {
				return result;
			}
			if (isClosed) {
				return new Response("Service Unavailable", { status: 503 });
			}

			let state!: State<P, Context>;
			const session = createSession(
				handlers,
				{
					sendOperations(payload) {
						if (!state.operations?.send(payload)) {
							throw new Error("The operation stream rejected a send");
						}
					},
					sendRegistry(payload) {
						if (!state.registry?.send(payload)) {
							throw new Error("The datagram registry stream rejected a send");
						}
					},
					sendDatagram: (payload, _sendOptions?: DatagramWritableOptions) =>
						nativeSession.sendDatagram(payload),
					close() {
						state.operations?.close();
						state.registry?.close();
					},
				},
				result,
				options,
			);

			state = { session };
			sessions.set(nativeSession, state);
			void session.closed.then(() => sessions.delete(nativeSession));

			return new Response(null, {
				status: 200,
				headers: { "WT-Protocol": JSON.stringify(subprotocol) },
			});
		},
		datagram(nativeSession, data) {
			sessions.get(nativeSession)?.session.receiveDatagram(data);
		},
		webTransportStream(stream) {
			const state = sessions.get(stream.session);

			if (!state) {
				stream.close();

				return;
			}

			streams.set(stream, { state });
		},
		webTransportData(stream, data) {
			const streamState = streams.get(stream);

			if (!streamState) {
				return;
			}

			let chunk = data;

			if (streamState.role === undefined) {
				if (data.byteLength === 0) {
					return;
				}

				streamState.role = data[0];
				chunk = data.subarray(1);

				if (streamState.role === operationsRole && !streamState.state.operations) {
					streamState.state.operations = stream;
				} else if (streamState.role === datagramsRole && !streamState.state.registry) {
					streamState.state.registry = stream;
				} else {
					streamState.state.session.close("Invalid or duplicate WebTransport stream role");

					return;
				}
			}

			if (chunk.byteLength === 0) {
				return;
			}

			if (streamState.role === operationsRole) {
				streamState.state.session.receiveOperations(chunk);
			} else {
				streamState.state.session.receiveRegistry(chunk);
			}
		},
		webTransportStreamEnd(stream, reason, errorCode) {
			const streamState = streams.get(stream);

			streams.delete(stream);
			if (!streamState) {
				return;
			}

			if (streamState.role === operationsRole) {
				if (reason === "finished") {
					streamState.state.session.finishOperations();
				} else {
					streamState.state.session.disconnect(`Operation stream aborted with code ${errorCode ?? 0}`);
				}
			} else if (streamState.role === datagramsRole) {
				if (reason === "finished") {
					streamState.state.session.finishRegistry();
				} else {
					streamState.state.session.disconnect(
						`Datagram registry stream aborted with code ${errorCode ?? 0}`,
					);
				}
			}
		},
		close(reason?: unknown) {
			if (isClosed) {
				return;
			}
			isClosed = true;

			for (const state of sessions.values()) {
				state.session.close(reason);
			}
			sessions.clear();
			streams.clear();
		},
		[Symbol.dispose]() {
			this.close();
		},
	};

	return adapter;
}

export namespace createNodeAdapter {
	export type Adapter = NodeAdapter;
	export type Handlers<P extends T.Protocol, Context = undefined> = T.Handlers<P, Context>;
	export type Options<Context = undefined> = NodeAdapterOptions<Context>;
	export type Protocol = T.Protocol;
	export type ProtocolType<Value> = T.ProtocolType<Value>;
}

export type * from "../lib/types.js";

const availableProtocols = (value: string | readonly string[] | undefined): string[] => {
	const input = typeof value === "string" ? value : (value?.join(",") ?? "");

	return input
		.split(",")
		.map((entry) => entry.trim())
		.map((entry) => (entry.startsWith('"') && entry.endsWith('"') ? entry.slice(1, -1) : entry))
		.filter(Boolean);
};
