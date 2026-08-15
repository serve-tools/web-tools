import type { websocket } from "../src/client-signals.js";
import { messaging, sharedWebsocket } from "../src/client-signals.js";

const websocketObserve: typeof websocket.observe = sharedWebsocket.observe;
const messagingObserve = messaging.observe;

void websocketObserve;
void messagingObserve;
