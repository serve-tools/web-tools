import { connect } from "@serve-tools/client-event-source";

export function connectStatus(
	url: string | URL,
	signal?: AbortSignal,
): { states: string[]; close: () => void; closed: Promise<void> } {
	const client = connect<{ status: { state: string } }>(url, { signal });
	const states: string[] = [];
	client.subscribe("status", ({ data, lastEventId }) => states.push(`${lastEventId}:${data.state}`));

	return { states, close: client.close, closed: client.closed };
}
