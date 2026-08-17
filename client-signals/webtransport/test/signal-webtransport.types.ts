import type { Client } from "@serve-tools/client-webtransport";
import { observe } from "../src/signal-webtransport.js";

declare const client: Client<{ subscriptions: { presence(room: string): boolean } }>;

observe(client, "presence", { input: "lobby" });
// @ts-expect-error input must match the subscription
observe(client, "presence", { input: 1 });
