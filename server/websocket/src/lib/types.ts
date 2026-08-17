export type * from "@serve-tools/server-realtime";

/** The subset of a WHATWG WebSocket required by {@link import("./attach.js").attach}. */
export interface WebSocketLike {
	binaryType: BinaryType;
	readonly bufferedAmount: number;
	readonly readyState: number;
	send(data: ArrayBuffer): void;
	close(code?: number, reason?: string): void;
	addEventListener(type: "message", listener: (event: MessageEvent) => void): void;
	addEventListener(type: "close", listener: (event: CloseEvent) => void, options?: AddEventListenerOptions): void;
	addEventListener(type: "error", listener: (event: Event) => void, options?: AddEventListenerOptions): void;
	removeEventListener(type: "message", listener: (event: MessageEvent) => void): void;
	removeEventListener(type: "close", listener: (event: CloseEvent) => void): void;
	removeEventListener(type: "error", listener: (event: Event) => void): void;
}
