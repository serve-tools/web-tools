import { connect, observe } from "../src/signal-event-source.js";

export const client = connect<{ presence: { online: number } }>("https://example.com/events");
export const presence = observe(client, "presence");
