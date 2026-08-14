import type { InteractionResult } from "./.result.js";
import { failed, settle, unavailable } from "./.result.js";

/** Reads all available items from the system clipboard. */
export const readFromClipboard = (): Promise<InteractionResult<ClipboardItems>> => {
	if (!isClipboardReadAvailable()) {
		return Promise.resolve(unavailable("Clipboard read"));
	}

	try {
		return settle(navigator.clipboard.read());
	} catch (error) {
		return Promise.resolve(failed(error));
	}
};

/**
 * Writes clipboard representations while allowing their data to resolve asynchronously.
 * Call this function synchronously during the initiating user gesture.
 */
export const writeToClipboard = (...items: ClipboardData[]): Promise<InteractionResult<void>> => {
	if (!isClipboardWriteAvailable()) {
		return Promise.resolve(unavailable("Clipboard write"));
	}

	try {
		const writing = navigator.clipboard.write(items.map((item) => new ClipboardItem(item)));

		return settle(writing);
	} catch (error) {
		return Promise.resolve(failed(error));
	}
};

/** Returns whether arbitrary clipboard reads are exposed in the current secure context. */
export const isClipboardReadAvailable = (): boolean =>
	globalThis.isSecureContext && typeof navigator?.clipboard?.read === "function";

/** Returns whether arbitrary clipboard writes are exposed in the current secure context. */
export const isClipboardWriteAvailable = (): boolean =>
	globalThis.isSecureContext &&
	typeof ClipboardItem === "function" &&
	typeof navigator?.clipboard?.write === "function";

/** MIME representations for one clipboard item, including asynchronously produced data. */
export type ClipboardData = Record<string, string | Blob | PromiseLike<string | Blob>>;
