import type { SharedHTTPStreamClient } from "@serve-tools/client-shared-http-stream/scope/window";
import { observe } from "../src/signal-shared-http-stream.js";

declare const client: SharedHTTPStreamClient<{
	subscriptions: { presence(room: string): { online: boolean } };
}>;

export const presence = observe(client, "presence", { input: "lobby" });
