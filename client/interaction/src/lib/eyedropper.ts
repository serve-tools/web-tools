import type { InteractionResult } from "./.result.js";
import { failed, isAbortError, settle, unavailable } from "./.result.js";

/** Opens the browser eyedropper and reports selection, abortion, or failure explicitly. */
export const openEyeDropper = (options?: EyeDropperOptions): Promise<InteractionResult<string>> => {
	if (!isEyeDropperApiAvailable()) {
		return Promise.resolve(unavailable("EyeDropper"));
	}

	try {
		const selection = new EyeDropper!().open(options).then((result) => result.sRGBHex);

		return settle(
			selection,
			(reason) => isAbortError(reason) || Boolean(options?.signal?.aborted && reason === options.signal.reason),
		);
	} catch (error) {
		return Promise.resolve(failed(error));
	}
};

/** Returns whether the EyeDropper API is exposed in the current secure context. */
export const isEyeDropperApiAvailable = (): boolean => globalThis.isSecureContext && typeof EyeDropper === "function";

/** Options for opening an eyedropper. */
export interface EyeDropperOptions {
	/** Aborts an active eyedropper operation. */
	readonly signal?: AbortSignal;
}

// #region Types

interface EyeDropperInstance {
	open(options?: EyeDropperOptions): Promise<EyeDropperSelection>;
}

interface EyeDropperConstructor {
	new (): EyeDropperInstance;
}

interface EyeDropperSelection {
	readonly sRGBHex: string;
}

declare var EyeDropper: EyeDropperConstructor | undefined;

// #endregion Types
