import type { IdleRequestCallback } from "./types.js";

export const callbacks = new Map<number, ScheduledCallback>();

let channel: MessageChannel | undefined;
let hiddenDelay = 0;
let isScheduled = false;
let nextHandle = 0;

export const getNextHandle = () => ++nextHandle;

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

export const resetScheduleIfEmpty = () => {
	if (!callbacks.size) {
		isScheduled = false;
	}
};

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

function updateHiddenDelay(): void {
	hiddenDelay = document.hidden ? 10_000 : 0;
}

function runCallbacks(): void {
	const end = performance.now() + 50;
	const lastRunnableHandle = nextHandle;

	try {
		for (const [handle, scheduled] of callbacks) {
			if (handle > lastRunnableHandle || performance.now() >= end) {
				break;
			}

			callbacks.delete(handle);

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

// #region Types

export interface ScheduledCallback {
	callback: IdleRequestCallback;
	timeoutHandle?: ReturnType<typeof setTimeout>;
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

// #endregion Types
