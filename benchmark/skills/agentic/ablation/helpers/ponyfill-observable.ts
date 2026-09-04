import type { Observable } from "@serve-tools/ponyfill-observable";

/** Resolves with the first emitted value and cancels the cold subscription immediately afterward. */
export function firstValue<Value>(source: Observable<Value>, signal?: AbortSignal): Promise<Value> {
	return source.first({ signal });
}
