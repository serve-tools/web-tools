import { when } from "@serve-tools/ponyfill-observable";

export function watchUntilAborted(target: EventTarget, signal: AbortSignal): { seen: string[]; stop(): void } {
	if (!(target instanceof EventTarget) || !(signal instanceof AbortSignal)) {
		throw new TypeError("Expected an EventTarget and AbortSignal");
	}

	const seen: string[] = [];
	const controller = new AbortController();

	when(target, "note").subscribe((event) => seen.push(String((event as CustomEvent).detail)), {
		signal: AbortSignal.any([signal, controller.signal]),
	});

	return { seen, stop: () => controller.abort() };
}
