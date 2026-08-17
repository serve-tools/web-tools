import type { Client } from "@serve-tools/client-webtransport";
import { observe } from "../src/signal-webtransport.js";

declare const client: Client<{ subscriptions: { presence(room: string): { online: boolean } } }>;

export const presence = observe(client, "presence", { input: "lobby" });
