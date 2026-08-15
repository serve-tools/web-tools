import type { InteractionResult } from "./.result.js";
import { failed, isAbortError, settle, unavailable } from "./.result.js";

/** Opens the native share target chooser with already-prepared data. */
export const share = (data: ShareData): Promise<InteractionResult<void>> => {
	if (!isShareApiAvailable()) {
		return Promise.resolve(unavailable("Web Share"));
	}

	try {
		return settle(navigator.share(data), isAbortError);
	} catch (error) {
		return Promise.resolve(failed(error));
	}
};

/** Returns whether the Web Share API is exposed in the current secure context. */
export const isShareApiAvailable = (): boolean => globalThis.isSecureContext && typeof navigator.share === "function";

/** Native share data with at least one member present. */
export type ShareData = {
	/** Files to share. */
	files?: File[];

	/** Text to share. */
	text?: string;

	/** A title that the selected target may use. */
	title?: string;

	/** A URL to share. */
	url?: string;
} & ({ files: File[] } | { text: string } | { title: string } | { url: string });
