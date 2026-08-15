# Recipe: quick start

This public-import example is generated from the compile-checked `test/client-signals.recipes.ts` fixture in the package source.

```ts
import { sharedWebsocket, websocket } from "@serve-tools/client-signals";

export const observeSocket = websocket.observe;
export const observeSharedSocket = sharedWebsocket.observe;
```
