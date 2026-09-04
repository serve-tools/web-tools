import { connect } from "@serve-tools/client-event-source";

export function connectStatus(
	url: string | URL,
	signal?: AbortSignal,
): { states: string[]; close(): void; closed: Promise<void> } {
	if (signal !== undefined && !(signal instanceof AbortSignal)) {
		throw new TypeError("Expected an AbortSignal");
	}

	const states: string[] = [];
	const client = connect<{ status: { state: string } }>(url, { signal });

	client.subscribe("status", ({ data, lastEventId }) => states.push(`${lastEventId}:${data.state}`));

	return { states, close: client.close, closed: client.closed };
}
