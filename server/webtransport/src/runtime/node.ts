import { reportError } from "@serve-tools/polyfill-report-error";
import type { Protocol, ProtocolDefinition } from "@serve-tools/realtime-protocol";
import {
	offersWebTransportSubprotocol,
	subprotocol,
	webTransportDatagramRegistryRole,
	webTransportOperationsRole,
} from "@serve-tools/realtime-protocol";
import { createSession } from "../lib/session.js";
import type * as T from "../lib/types.js";
import type { Awaitable, DatagramWritableOptions, Handlers, Session, SessionOptions } from "../lib/types.js";

/** The native WebTransport session operations required by the Node adapter. */
export interface NodeWebTransportSessionLike {
	/** Request headers supplied with the incoming WebTransport session. */
	readonly headers: Readonly<Record<string, string | readonly string[] | undefined>>;

	/** Request path associated with the incoming WebTransport session. */
	readonly path: string;

	/** Sends one best-effort datagram and reports whether the native session accepted it. */
	sendDatagram(data: Uint8Array): boolean;
}

/** The native reliable-stream operations required by the Node WebTransport adapter. */
export interface NodeWebTransportStreamLike {
	/** The native WebTransport session that owns this reliable stream. */
	readonly session: NodeWebTransportSessionLike;

	/** Sends reliable stream bytes and optionally marks the stream as finished. */
	send(
		data: Uint8Array,
		options?: {
			/** Signals that this chunk completes the sending side of the stream. */
			readonly fin?: boolean;
		},
	): boolean;

	/** Closes the stream, optionally sending one final chunk. */
	close(data?: Uint8Array): boolean;
}

/** Authorization and protocol limits applied to native Node WebTransport sessions. */
export interface NodeAdapterOptions<Context = undefined> extends SessionOptions {
	/** Establishes session context or returns an HTTP response rejecting the incoming session. */
	readonly authorize?: (session: NodeWebTransportSessionLike) => Awaitable<Context | Response>;
}

/** Native Node WebTransport lifecycle callbacks implemented by the adapter. */
export interface NodeHandlers {
	/** Authorizes and opens one incoming native WebTransport session. */
	session(session: NodeWebTransportSessionLike): Promise<Response | false>;

	/** Dispatches one incoming best-effort datagram to its owning session. */
	datagram(session: NodeWebTransportSessionLike, data: Uint8Array): void;

	/** Registers a newly opened reliable WebTransport stream. */
	webTransportStream(stream: NodeWebTransportStreamLike): void;

	/** Assigns the stream role when necessary and dispatches incoming reliable bytes. */
	webTransportData(stream: NodeWebTransportStreamLike, data: Uint8Array): void;

	/** Finishes or aborts a reliable stream and updates its owning protocol session. */
	webTransportStreamEnd(stream: NodeWebTransportStreamLike, reason: "finished" | "aborted", errorCode?: number): void;
}

/** Disposable native WebTransport callbacks owning every accepted protocol session. */
export interface NodeAdapter extends NodeHandlers, Disposable {
	/** Closes every active protocol session and rejects subsequent incoming sessions. */
	close(reason?: unknown): void;
}

interface State<P extends Protocol, Context> {
	readonly session: Session<P, Context>;
	readonly streams: Set<NodeWebTransportStreamLike>;
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

	const closeState = (nativeSession: NodeWebTransportSessionLike, state: State<P, Context>): void => {
		if (sessions.get(nativeSession) === state) {
			sessions.delete(nativeSession);
		}

		for (const stream of state.streams) {
			streams.delete(stream);
			stream.close();
		}

		state.streams.clear();
		delete state.operations;
		delete state.registry;
	};

	const adapter: NodeAdapter = {
		async session(nativeSession) {
			if (isClosed) {
				return new Response("Service Unavailable", { status: 503 });
			}

			if (!offersWebTransportSubprotocol(nativeSession.headers["wt-available-protocols"])) {
				return new Response("WebTransport Protocol Required", { status: 400 });
			}

			let result: Context | Response;

			try {
				result = options.authorize ? await options.authorize(nativeSession) : (undefined as Context);
			} catch (error) {
				reportError(error);

				return error instanceof Response ? error : new Response("Internal Server Error", { status: 500 });
			}

			if (result instanceof Response) {
				return result;
			}
			if (isClosed) {
				return new Response("Service Unavailable", { status: 503 });
			}

			let state!: State<P, Context>;
			let session: Session<P, Context>;

			try {
				session = createSession(
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
						close: () => closeState(nativeSession, state),
					},
					result,
					options,
				);
			} catch (error) {
				reportError(error);

				return new Response("Internal Server Error", { status: 500 });
			}

			state = { session, streams: new Set() };

			sessions.set(nativeSession, state);

			void session.closed.then(() => closeState(nativeSession, state));

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
			state.streams.add(stream);
		},
		webTransportData(stream, data) {
			const streamState = streams.get(stream);

			if (!streamState) {
				return;
			}

			const state = streamState.state;
			let chunk = data;

			if (streamState.role === undefined) {
				if (data.byteLength === 0) {
					return;
				}

				streamState.role = data[0];

				chunk = data.subarray(1);

				if (streamState.role === webTransportOperationsRole && !state.operations) {
					state.operations = stream;
				} else if (streamState.role === webTransportDatagramRegistryRole && !state.registry) {
					state.registry = stream;
				} else {
					state.session.close("Invalid or duplicate WebTransport stream role");

					return;
				}
			}

			if (chunk.byteLength === 0) {
				return;
			}

			if (streamState.role === webTransportOperationsRole) {
				state.session.receiveOperations(chunk);
			} else {
				state.session.receiveRegistry(chunk);
			}
		},
		webTransportStreamEnd(stream, reason, errorCode) {
			const streamState = streams.get(stream);

			streams.delete(stream);
			streamState?.state.streams.delete(stream);

			if (!streamState) {
				return;
			}

			const session = streamState.state.session;

			if (streamState.role === webTransportOperationsRole) {
				if (reason === "finished") {
					session.finishOperations();
				} else {
					session.disconnect(`Operation stream aborted with code ${errorCode ?? 0}`);
				}
			} else if (streamState.role === webTransportDatagramRegistryRole) {
				if (reason === "finished") {
					session.finishRegistry();
				} else {
					session.disconnect(`Datagram registry stream aborted with code ${errorCode ?? 0}`);
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

/** Types used by {@link createNodeAdapter}. */
export namespace createNodeAdapter {
	/** Disposable native WebTransport callbacks owning active protocol sessions. */
	export type Adapter = NodeAdapter;

	/** Request, subscription, and incoming datagram handler tables. */
	export type Handlers<P extends T.Protocol, Context = undefined> = T.Handlers<P, Context>;

	/** Native session authorization options and protocol connection limits. */
	export type Options<Context = undefined> = NodeAdapterOptions<Context>;

	/** A compile-time collection of named operations and directional datagrams. */
	export type Protocol = T.Protocol;

	/** Extracts the protocol retained by a resolved or pending resource. */
	export type ProtocolType<Value> = T.ProtocolType<Value>;
}

export type * from "../lib/types.js";
