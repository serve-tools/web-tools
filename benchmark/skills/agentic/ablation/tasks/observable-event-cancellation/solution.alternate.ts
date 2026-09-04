import { when } from "@serve-tools/ponyfill-observable";

const isAbortSignal = (value: unknown): value is AbortSignal =>
	value instanceof AbortSignal || Object.prototype.toString.call(value) === "[object AbortSignal]";

export function watchUntilAborted(target: EventTarget, signal: AbortSignal): { seen: string[]; stop: () => void } {
	if (!(target instanceof EventTarget) || !isAbortSignal(signal)) {
		throw new TypeError("target and signal must be EventTarget and AbortSignal");
	}

	const controller = new AbortController();
	const combined = AbortSignal.any([signal, controller.signal]);
	const seen: string[] = [];

	when(target, "note").subscribe((event) => seen.push(String((event as CustomEvent).detail)), { signal: combined });

	return {
		seen,
		stop: () => controller.abort(),
	};
}
