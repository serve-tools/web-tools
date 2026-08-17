import type { Client } from "@serve-tools/client-http-stream";
import { observe } from "../src/signal-http-stream.js";

declare const client: Client<{ subscriptions: { presence(room: string): { online: boolean } } }>;

export const presence = observe(client, "presence", { input: "lobby" });
