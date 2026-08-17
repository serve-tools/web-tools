import { listen } from "@serve-tools/signal-shared-event-source/scope/shared-worker";
import { connect, observe } from "../src/signal-shared-event-source.js";

interface Events {
	presence: { online: number };
}

declare const port: Parameters<typeof connect>[0];

export const server = listen<Events>("https://example.com/events");
export const client = connect<Events>(port);
export const presence = observe(client, "presence");
