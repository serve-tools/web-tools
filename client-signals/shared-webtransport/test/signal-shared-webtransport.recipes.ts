import type { SharedWebTransportClient } from "@serve-tools/client-shared-webtransport/scope/window";
import { observe } from "../src/signal-shared-webtransport.js";

declare const client: SharedWebTransportClient<{
	subscriptions: { presence(room: string): { online: boolean } };
}>;

export const presence = observe(client, "presence", { input: "lobby" });
