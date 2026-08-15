import type { Client } from "@serve-tools/client-websocket";
import { observe } from "@serve-tools/signal-websocket";

declare const client: Client<{ subscriptions: { presence(room: string): { online: boolean } } }>;

export const presence = observe(client, "presence", { input: "lobby" });
