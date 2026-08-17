import type { Client } from "../src/signal-http-stream.js";
import { observe } from "../src/signal-http-stream.js";

declare const client: Client<{ subscriptions: { presence(room: string): boolean } }>;

observe(client, "presence", { input: "lobby" });
// @ts-expect-error input must match the subscription
observe(client, "presence", { input: 1 });
