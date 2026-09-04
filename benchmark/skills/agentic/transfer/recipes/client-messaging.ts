import type { Client, Server, SubscribeOptions } from "@serve-tools/client-messaging";
import { connect, serve, transfer } from "@serve-tools/client-messaging";

export interface LocalMessageProtocol {
	requests: {
		copy(input: ArrayBuffer): ArrayBuffer;
		wait(milliseconds: number): "elapsed";
	};
	subscriptions: {
		sequence(input: { readonly start: number; readonly count: number }): number;
	};
}

export interface LocalMessageSession {
	readonly client: Client<LocalMessageProtocol>;
	readonly server: Server<LocalMessageProtocol>;
	readonly ports: readonly [MessagePort, MessagePort];
	close(reason?: unknown): void;
}

export interface LocalMessageHooks {
	readonly onRequestAbort?: () => void;
	readonly onSubscriptionCleanup?: () => void;
}

const nonNegativeSafeInteger = (value: unknown, name: string): number => {
	if (!Number.isSafeInteger(value) || (value as number) < 0 || Object.is(value, -0)) {
		throw new TypeError(`${name} must be a non-negative safe integer`);
	}

	return value as number;
};

/** Opens both protocol owners over a locally owned MessageChannel. */
export const openLocalMessageSession = (hooks: LocalMessageHooks = {}): LocalMessageSession => {
	const { port1, port2 } = new MessageChannel();
	const server = serve<LocalMessageProtocol>(port1, {
		requests: {
			copy(input) {
				const output = input.slice(0);

				return transfer(output, [output]);
			},
			wait(milliseconds, { signal }) {
				const delay = nonNegativeSafeInteger(milliseconds, "milliseconds");

				return new Promise<"elapsed">((resolve, reject) => {
					const finish = (): void => {
						signal.removeEventListener("abort", abort);
						resolve("elapsed");
					};
					const abort = (): void => {
						clearTimeout(timeout);
						hooks.onRequestAbort?.();
						reject(signal.reason);
					};
					const timeout = setTimeout(finish, delay);

					if (signal.aborted) {
						abort();
					} else {
						signal.addEventListener("abort", abort, { once: true });
					}
				});
			},
		},
		subscriptions: {
			sequence(input, context) {
				const start = nonNegativeSafeInteger(input.start, "start");
				const count = nonNegativeSafeInteger(input.count, "count");

				queueMicrotask(() => {
					if (context.signal.aborted) {
						return;
					}

					for (let offset = 0; offset < count; ++offset) {
						context.emit(start + offset);
					}

					context.complete();
				});

				return () => hooks.onSubscriptionCleanup?.();
			},
		},
	});
	const client = connect<LocalMessageProtocol>(port2);

	let closed = false;

	return {
		client,
		server,
		ports: [port1, port2],
		close(reason?: unknown) {
			if (closed) {
				return;
			}

			closed = true;
			client.close(reason);
			server.close(reason);
			port1.close();
			port2.close();
		},
	};
};

/** Transfers request ownership of `input` and returns the independently transferred response buffer. */
export const requestTransferredCopy = (
	client: Client<LocalMessageProtocol>,
	input: ArrayBuffer,
): Promise<ArrayBuffer> => client.request("copy", input, { transfer: [input] });

/** Collects one finite subscription and reports remote errors through the returned promise. */
export const collectSequence = (
	client: Client<LocalMessageProtocol>,
	input: { readonly start: number; readonly count: number },
	options: Pick<SubscribeOptions, "signal"> = {},
): Promise<number[]> => {
	const { signal } = options;

	if (signal?.aborted) {
		return Promise.reject(signal.reason);
	}

	return new Promise((resolve, reject) => {
		const values: number[] = [];
		let settled = false;
		const finish = (callback: () => void): void => {
			if (settled) {
				return;
			}

			settled = true;
			signal?.removeEventListener("abort", abort);
			callback();
		};
		const abort = (): void => finish(() => reject(signal?.reason));

		signal?.addEventListener("abort", abort, { once: true });

		try {
			client.subscribe("sequence", input, (value) => values.push(value), {
				...options,
				onComplete: () => finish(() => resolve(values)),
				onError: (error) => finish(() => reject(error)),
			});
		} catch (error) {
			finish(() => reject(error));
		}
	});
};

// Add your task adapter below.
