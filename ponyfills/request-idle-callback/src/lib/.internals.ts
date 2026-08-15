import type { IdleRequestCallback } from "./IdleRequestCallback.js";
import type { IdleRequestOptions } from "./IdleRequestOptions.js";

export interface ScheduledCallback {
	callback: IdleRequestCallback;
	timeoutHandle?: ReturnType<typeof setTimeout>;
}

export const callbacks = new Map<number, ScheduledCallback>();

let channel: MessageChannel | undefined;
let hiddenDelay = 0;
let isScheduled = false;
let nextHandle = 0;

export const getNextHandle = () => ++nextHandle;

export const clearCallbackTimeout = (handle: ReturnType<typeof setTimeout>) => clearTimeout(handle);

export const setCallbackTimeout = (callback: () => void, timeout: number) => setTimeout(callback, timeout);

export const resetScheduleIfEmpty = () => {
	if (!callbacks.size) {
		isScheduled = false;
	}
};

export function getChannel(): MessageChannel {
	if (channel) {
		return channel;
	}

	channel = new MessageChannel();
	channel.port1.onmessage = runCallbacks;

	document.addEventListener("visibilitychange", updateHiddenDelay);

	updateHiddenDelay();

	return channel;
}

function updateHiddenDelay(): void {
	hiddenDelay = document.hidden ? 10_000 : 0;
}

function runCallbacks(): void {
	const end = performance.now() + 50;
	const runnableCallbacks = Array.from(callbacks);

	try {
		for (const [handle, scheduled] of runnableCallbacks) {
			if (performance.now() >= end) {
				break;
			}

			if (!callbacks.delete(handle)) {
				continue;
			}

			if (scheduled.timeoutHandle !== undefined) {
				clearTimeout(scheduled.timeoutHandle);
			}

			scheduled.callback({
				didTimeout: false,
				timeRemaining: () => Math.max(0, end - performance.now()),
			});
		}
	} finally {
		isScheduled = false;

		if (callbacks.size) {
			schedule();
		}
	}
}

export function schedule(): void {
	if (isScheduled) {
		return;
	}

	isScheduled = true;

	requestAnimationFrame(() => {
		const postMessage = () => getChannel().port2.postMessage(null);

		hiddenDelay ? setTimeout(postMessage, hiddenDelay) : postMessage();
	});
}

/** Schedules work for an idle period and returns its cancellation handle. */
export function requestIdleCallback(callback: IdleRequestCallback, options?: IdleRequestOptions): number {
	getChannel();

	const handle = ++nextHandle;
	const scheduled: ScheduledCallback = { callback };

	if (options?.timeout !== undefined && options.timeout > 0) {
		scheduled.timeoutHandle = setTimeout(() => {
			if (!callbacks.delete(handle)) {
				return;
			}

			if (!callbacks.size) {
				isScheduled = false;
			}

			callback({ didTimeout: true, timeRemaining: () => 0 });
		}, options.timeout);
	}

	callbacks.set(handle, scheduled);

	schedule();

	return handle;
}

/** Cancels a callback previously scheduled by this module. */
export function cancelIdleCallback(handle: number): void {
	const scheduled = callbacks.get(handle);

	if (scheduled?.timeoutHandle !== undefined) {
		clearTimeout(scheduled.timeoutHandle);
	}

	if (callbacks.delete(handle) && !callbacks.size) {
		isScheduled = false;
	}
}

declare var MessageChannel: typeof globalThis extends { onmessage: any; MessageChannel: infer T }
	? T
	: { new (): MessageChannel };

declare var clearTimeout: typeof globalThis extends { onmessage: any; clearTimeout: infer T }
	? T
	: { (value: number): void };

declare var document: typeof globalThis extends { onmessage: any; document: infer T }
	? T
	: {
			hidden: boolean;
			addEventListener(type: "visibilitychange", listener: (event: Event) => void): void;
		};

declare var performance: typeof globalThis extends { onmessage: any; performance: infer T } ? T : { now(): number };

declare var requestAnimationFrame: typeof globalThis extends { onmessage: any; requestAnimationFrame: infer T }
	? T
	: { (callback: (time: number) => void): number };

declare var setTimeout: typeof globalThis extends { onmessage: any; setTimeout: infer T }
	? T
	: { (handler: (...args: unknown[]) => void, timeout?: number): number };

type Event = typeof globalThis extends { onmessage: any; Event: { new (...args: any[]): infer T } } ? T : object;

type MessageChannel = typeof globalThis extends { onmessage: any; MessageChannel: { new (...args: any[]): infer T } }
	? T
	: { port1: MessagePort; port2: MessagePort };

type MessageEvent = typeof globalThis extends { onmessage: any; MessageEvent: { new (...args: any[]): infer T } }
	? T
	: Event & { data: any };

type MessagePort = typeof globalThis extends { onmessage: any; MessagePort: { new (...args: any[]): infer T } }
	? T
	: {
			postMessage(message: unknown, transfer?: readonly Transferable[]): void;
			onmessage: ((event: MessageEvent) => void) | null;
		};

type Transferable = typeof globalThis extends { onmessage: any; Transferable: infer T }
	? T
	: ArrayBufferView | ArrayBuffer;
