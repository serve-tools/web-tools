import { SuppressedError as value } from "../exports/SuppressedError.js";

globalThis.SuppressedError ?? (globalThis.SuppressedError = value);

declare global {
	/** The native or installed constructor for errors that preserve a suppressed failure. */
	var SuppressedError: typeof globalThis extends { onmessage: any; SuppressedError: infer T } ? T : typeof value;
}
