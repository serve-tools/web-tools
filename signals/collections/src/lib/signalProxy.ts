import { Signal } from "@serve-tools/signal";
import type { VersionSignal } from "./.internals.js";
import { consumeKey, versionSignal } from "./.internals.js";

/** Creates a shallow signal-backed proxy around a plain record. */
export function signalProxy(target: object): object {
	return new Proxy(target as PropertyBag, new SignalHandler());
}

class SignalHandler implements ProxyHandler<PropertyBag> {
	#presence: Map<Key, VersionSignal> | undefined;
	#values: Map<Key, VersionSignal> | undefined;
	#structure: VersionSignal | undefined;

	get(target: PropertyBag, key: Key): unknown {
		if (Signal.subtle.currentComputed() !== undefined) {
			consumeKey((this.#values ??= new Map()), key);
		}

		return target[key];
	}

	has(target: PropertyBag, key: Key): boolean {
		if (Signal.subtle.currentComputed() !== undefined) {
			consumeKey((this.#presence ??= new Map()), key);
		}

		return Reflect.has(target, key);
	}

	ownKeys(target: PropertyBag): ArrayLike<Key> {
		if (Signal.subtle.currentComputed() !== undefined) {
			(this.#structure ??= versionSignal()).get();
		}

		return Reflect.ownKeys(target);
	}

	set(target: PropertyBag, key: Key, value: unknown): boolean {
		const had = Object.hasOwn(target, key);

		if (had && Object.is(target[key], value)) {
			return true;
		}

		if (!Reflect.set(target, key, value)) {
			return false;
		}

		this.#values?.get(key)?.set(undefined);

		if (!had) {
			this.#presence?.get(key)?.set(undefined);
			this.#structure?.set(undefined);
		}

		return true;
	}

	deleteProperty(target: PropertyBag, key: Key): boolean {
		const had = Object.hasOwn(target, key);
		const result = Reflect.deleteProperty(target, key);

		if (result && had) {
			this.#presence?.get(key)?.set(undefined);
			this.#values?.get(key)?.set(undefined);
			this.#presence?.delete(key);
			this.#values?.delete(key);
			this.#structure?.set(undefined);
		}

		return result;
	}
}

type Key = string | symbol;
type PropertyBag = Record<Key, unknown>;
