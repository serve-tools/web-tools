# Recipe: quick start

This public-import example is generated from the compile-checked `test/client-signals.recipes.ts` fixture in the package source.

```ts
import {
	httpStream,
	sharedHttpStream,
	sharedWebsocket,
	sharedWebtransport,
	websocket,
	webtransport,
} from "@serve-tools/client-signals";

export const observeSocket = websocket.observe;
export const observeSharedSocket = sharedWebsocket.observe;
export const observeHTTPStream = httpStream.observe;
export const observeSharedHTTPStream = sharedHttpStream.observe;
export const observeWebTransport = webtransport.observe;
export const observeSharedWebTransport = sharedWebtransport.observe;
```
