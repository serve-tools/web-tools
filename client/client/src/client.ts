/** Typed context providers, consumers, and late-registration coordination. */
export * as context from "./lib/context.js";

/** Promise-based IndexedDB connections, transactions, and scans. */
export * as db from "./lib/db.js";

/** Typed named events received through the native EventSource API. */
export * as eventSource from "./lib/event-source.js";

/** Typed request and subscription operations over HTTP streams. */
export * as httpStream from "./lib/http-stream.js";

/** Explicitly owned pointer and drag-and-drop input sessions. */
export * as input from "./lib/input.js";

/** Browser-mediated clipboard, file-picker, sharing, and eyedropper interactions. */
export * as interaction from "./lib/interaction.js";

/** Platform-aware keyboard chords, accessible labels, and visual symbols. */
export * as keyboard from "./lib/keyboard.js";

/** Typed requests and subscriptions over browser message endpoints. */
export * as messaging from "./lib/messaging.js";

/** Typed native browser navigation, route ownership, and automatic View Transitions. */
export * as router from "./lib/router.js";

/** EventSource connections shared across browsing contexts through a SharedWorker. */
export * as sharedEventSource from "./lib/shared-event-source.js";

/** HTTP-stream connections shared across browsing contexts through a SharedWorker. */
export * as sharedHttpStream from "./lib/shared-http-stream.js";

/** WebSocket connections shared across browsing contexts through a SharedWorker. */
export * as sharedWebsocket from "./lib/shared-websocket.js";

/** WebTransport connections shared across browsing contexts through a SharedWorker. */
export * as sharedWebtransport from "./lib/shared-webtransport.js";

/** Typed, observable access to local and session storage. */
export * as storage from "./lib/storage.js";

/** Typed requests and subscriptions over WebSocket connections. */
export * as websocket from "./lib/websocket.js";

/** Typed requests, subscriptions, and datagrams over WebTransport connections. */
export * as webtransport from "./lib/webtransport.js";
