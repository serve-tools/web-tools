import type { httpStream, websocket } from "../src/client-signals.js";
import {
	messaging,
	sharedHttpStream,
	sharedWebsocket,
	sharedWebtransport,
	webtransport,
} from "../src/client-signals.js";

const websocketObserve: typeof websocket.observe = sharedWebsocket.observe;
const httpStreamObserve: typeof httpStream.observe = sharedHttpStream.observe;
const webtransportObserve = webtransport.observe;
const sharedWebtransportObserve = sharedWebtransport.observe;
const messagingObserve = messaging.observe;

void websocketObserve;
void httpStreamObserve;
void webtransportObserve;
void sharedWebtransportObserve;
void messagingObserve;
