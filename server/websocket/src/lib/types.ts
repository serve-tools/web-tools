export type * from "@serve-tools/server-realtime";

/** The subset of a WHATWG WebSocket required by {@link import("./attach.js").attach}. */
export interface WebSocketLike {
	/** Configures the representation used for incoming binary frames. */
	binaryType: BinaryType;

	/** Returns the number of queued outbound bytes. */
	readonly bufferedAmount: number;

	/** Returns the WebSocket connection state. */
	readonly readyState: number;

	/** Sends one complete binary protocol message. */
	send(data: ArrayBuffer): void;

	/** Closes the WebSocket with an optional close code and reason. */
	close(code?: number, reason?: string): void;

	/** Registers a listener for incoming messages. */
	addEventListener(type: "message", listener: (event: MessageEvent) => void): void;

	/** Registers a listener for WebSocket closure. */
	addEventListener(type: "close", listener: (event: CloseEvent) => void, options?: AddEventListenerOptions): void;

	/** Registers a listener for WebSocket transport errors. */
	addEventListener(type: "error", listener: (event: Event) => void, options?: AddEventListenerOptions): void;

	/** Removes an incoming-message listener. */
	removeEventListener(type: "message", listener: (event: MessageEvent) => void): void;

	/** Removes a WebSocket-closure listener. */
	removeEventListener(type: "close", listener: (event: CloseEvent) => void): void;

	/** Removes a WebSocket-error listener. */
	removeEventListener(type: "error", listener: (event: Event) => void): void;
}
