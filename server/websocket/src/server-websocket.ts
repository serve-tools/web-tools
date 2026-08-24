/** The WebSocket subprotocol required by this package. */
export { subprotocol } from "@serve-tools/realtime-protocol";

/** Creates a transport-neutral typed protocol connection. */
export { createConnection } from "@serve-tools/server-realtime";

/** Attaches a protocol connection to an accepted WHATWG-compatible WebSocket. */
export * from "./lib/attach.js";

/** Exposes the WebSocket adapter and server-realtime type contracts. */
export type * from "./lib/types.js";
