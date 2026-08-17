/// <reference lib="esnext.disposable" />

import { createClient } from "@serve-tools/client-realtime";
import { subprotocol } from "@serve-tools/realtime-protocol";
import type * as T from "./types.js";
import type { Client, ConnectOptions, Protocol, ProtocolDefinition } from "./types.js";

/** Opens a typed request and subscription client over one WebSocket connection. */
export async function connect<const P extends Protocol & ProtocolDefinition<P>>(
	url: string | URL,
	options: ConnectOptions = {},
): Promise<Client<P>> {
	const socket = new WebSocket(url, subprotocol);

	socket.binaryType = "arraybuffer";

	await opened(socket, options.signal);

	if (socket.protocol !== subprotocol) {
		socket.close(1002, "Subprotocol required");

		throw Object.assign(new Error(`Expected the ${subprotocol} WebSocket subprotocol`), { name: "ProtocolError" });
	}

	const client = createClient<P>({
		send: (payload) => socket.send(payload),
		close: (reason) => {
			if (socket.readyState < WebSocket.CLOSING) {
				socket.close(reason instanceof Error && reason.name === "ProtocolError" ? 1002 : 1000);
			}
		},
	});
	const receive = ({ data }: MessageEvent): void => {
		if (data instanceof ArrayBuffer) {
			client.receive(data);
		} else {
			client.fail("Expected a binary WebSocket message");
		}
	};
	const disconnected = (event: CloseEvent): void => {
		client.disconnect(
			event.reason || (event.code === 1000 ? undefined : `WebSocket closed with code ${event.code}`),
		);
	};
	const failed = (): void => {
		client.disconnect(Object.assign(new Error("The WebSocket transport failed"), { name: "WebSocketError" }));
	};
	const cleanup = (): void => {
		socket.removeEventListener("message", receive);
		socket.removeEventListener("close", disconnected);
		socket.removeEventListener("error", failed);
	};

	socket.addEventListener("message", receive);
	socket.addEventListener("close", disconnected, { once: true });
	socket.addEventListener("error", failed, { once: true });

	void client.closed.then(cleanup);

	return client;
}

/** Types used by {@link connect}. */
export namespace connect {
	export type Client<P extends T.Protocol = T.Protocol> = T.Client<P>;
	export type Options = T.ConnectOptions;
	export type Protocol = T.Protocol;
	export type ProtocolType<Value> = T.ProtocolType<Value>;
	export type RequestOptions = T.RequestOptions;
	export type SubscribeOptions = T.SubscribeOptions;
	export type Subscription = T.Subscription;
}

const opened = (socket: WebSocket, signal?: AbortSignal): Promise<void> => {
	if (signal?.aborted) {
		socket.close();

		return Promise.reject(signal.reason);
	}

	return new Promise((resolve, reject) => {
		const cleanup = (): void => {
			socket.removeEventListener("open", open);
			socket.removeEventListener("error", error);
			socket.removeEventListener("close", close);
			signal?.removeEventListener("abort", abort);
		};
		const open = (): void => {
			cleanup();
			resolve();
		};
		const error = (): void => {
			cleanup();
			reject(Object.assign(new Error("The WebSocket connection failed"), { name: "WebSocketError" }));
		};
		const close = (event: CloseEvent): void => {
			cleanup();
			reject(
				Object.assign(new Error(event.reason || `WebSocket closed with code ${event.code}`), {
					name: "ConnectionClosedError",
				}),
			);
		};
		const abort = (): void => {
			cleanup();
			socket.close();
			reject(signal?.reason);
		};

		socket.addEventListener("open", open, { once: true });
		socket.addEventListener("error", error, { once: true });
		socket.addEventListener("close", close, { once: true });
		signal?.addEventListener("abort", abort, { once: true });
	});
};
