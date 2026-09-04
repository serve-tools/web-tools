import type { BindingScope } from "@serve-tools/client-signals/dom";
import type { httpStream, websocket } from "../src/client-signals.js";
import {
	dom,
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
const bindingScope: BindingScope = dom.createBindingScope();
const captured: string = bindingScope.capture(() => "preserved");

void websocketObserve;
void httpStreamObserve;
void webtransportObserve;
void sharedWebtransportObserve;
void messagingObserve;
void captured;
