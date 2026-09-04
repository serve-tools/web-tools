import { connect } from "@serve-tools/client-messaging";

/** Opens a message protocol and closes its ownership when the supplied signal aborts. */
export function connectUntilAborted(endpoint: MessagePort, signal: AbortSignal) {
	const client = connect(endpoint);
	const close = (): void => client.close(signal.reason);

	if (signal.aborted) {
		close();
	} else {
		signal.addEventListener("abort", close, { once: true });
		void client.closed.then(() => signal.removeEventListener("abort", close));
	}
	return client;
}
