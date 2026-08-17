import {
	eventSource,
	httpStream,
	messaging,
	sharedEventSource,
	sharedHttpStream,
	sharedWebsocket,
	sharedWebtransport,
	websocket,
	webtransport,
} from "@serve-tools/client-signals";

export const connectEventSource: typeof eventSource.connect = eventSource.connect;
export const observeEventSource = eventSource.observe;
export const connectMessaging: typeof messaging.connect = messaging.connect;
export const observeMessaging = messaging.observe;
export const connectSharedEventSource: typeof sharedEventSource.connect = sharedEventSource.connect;
export const observeSharedEventSource = sharedEventSource.observe;
export const connectSocket: typeof websocket.connect = websocket.connect;
export const observeSocket = websocket.observe;
export const connectSharedSocket: typeof sharedWebsocket.connect = sharedWebsocket.connect;
export const observeSharedSocket = sharedWebsocket.observe;
export const connectHTTPStream: typeof httpStream.connect = httpStream.connect;
export const observeHTTPStream = httpStream.observe;
export const connectSharedHTTPStream: typeof sharedHttpStream.connect = sharedHttpStream.connect;
export const observeSharedHTTPStream = sharedHttpStream.observe;
export const connectWebTransport: typeof webtransport.connect = webtransport.connect;
export const observeWebTransport = webtransport.observe;
export const connectSharedWebTransport: typeof sharedWebtransport.connect = sharedWebtransport.connect;
export const observeSharedWebTransport = sharedWebtransport.observe;
