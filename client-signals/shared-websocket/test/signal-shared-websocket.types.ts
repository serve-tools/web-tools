import type { SharedWebSocketClient } from "@serve-tools/client-shared-websocket/scope/window";
import { observe } from "../src/signal-shared-websocket.js";

declare const client: SharedWebSocketClient<{ subscriptions: { presence(room: string): boolean } }>;

observe(client, "presence", { input: "lobby" });
// @ts-expect-error input must match the subscription
observe(client, "presence", { input: 1 });
