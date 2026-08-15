import { sharedWebsocket, websocket } from "@serve-tools/client-signals";

export const observeSocket = websocket.observe;
export const observeSharedSocket = sharedWebsocket.observe;
