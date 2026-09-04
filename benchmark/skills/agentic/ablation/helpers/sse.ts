import type { JSONValue } from "@serve-tools/server-event-source";
import { createHandler } from "@serve-tools/server-event-source";

/** Creates a Fetch-native SSE handler with one deterministic initial event per connection. */
export function createInitialEventSource<Value extends JSONValue>(name: string, value: Value) {
	return createHandler<Record<string, JSONValue>>({
		connect(connection) {
			connection.send(name, value);
		},
	});
}
