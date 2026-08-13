import { Signal } from "@serve-tools/signal";

import { arrayIndexOf, type VersionSignal, versionSignal } from "./.internals.js";

/** An Array with lazy signal-backed index and collection reads. */
export const SignalArray = function SignalArray<Value = unknown>(values: readonly Value[] = []): SignalArray<Value> {
	return new Proxy(values.slice(), new SignalArrayHandler());
} as unknown as {
	/** Creates a signal-backed shallow copy of an array-like sequence. */
	new <Value = unknown>(values?: readonly Value[]): SignalArray<Value>;

	/** The prototype shared by SignalArray instances. */
	readonly prototype: SignalArray;
};

Object.setPrototypeOf(SignalArray.prototype, Array.prototype);

class SignalArrayHandler<Value> implements ProxyHandler<ArrayTarget<Value>> {
	#signals: Map<Key, VersionSignal> | undefined;
	#methods: Map<Key, ArrayMethod> | undefined;

	get(target: ArrayTarget<Value>, key: Key, receiver: SignalArray<Value>): unknown {
		if (key === "length") {
			this.#consume(key);

			return target.length;
		}

		const index = arrayIndexOf(key);

		if (index !== undefined) {
			this.#consume(index);

			return target[index];
		}

		if (collectionMethods.has(key)) {
			return this.#collectionMethod(target, key, receiver);
		}

		return target[key];
	}

	set(target: ArrayTarget<Value>, key: Key, value: Value): boolean {
		if (key === "length") {
			return this.#setLength(target, value);
		}

		const index = arrayIndexOf(key);

		if (index !== undefined) {
			return this.#setIndex(target, key, index, value);
		}

		target[key] = value;

		return true;
	}

	deleteProperty(target: ArrayTarget<Value>, key: Key): boolean {
		const index = arrayIndexOf(key);
		const present = Object.hasOwn(target, key);
		const result = Reflect.deleteProperty(target, key);

		if (result && present) {
			this.#dirty(index ?? key);
			this.#dirty(collectionKey);
		}

		return result;
	}

	getPrototypeOf(): object {
		return SignalArray.prototype;
	}

	#consume(key: Key): void {
		let signal = this.#signals?.get(key);

		if (signal !== undefined) {
			signal.get();

			return;
		}

		if (Signal.subtle.currentComputed() === undefined) {
			return;
		}

		const signals = (this.#signals ??= new Map());

		signal = versionSignal();

		signals.set(key, signal);

		signal.get();
	}

	#dirty(key: Key): void {
		this.#signals?.get(key)?.set(undefined);
	}

	#collectionMethod(target: ArrayTarget<Value>, key: Key, receiver: SignalArray<Value>): ArrayMethod {
		const methods = (this.#methods ??= new Map());

		let method = methods.get(key);

		if (method === undefined) {
			const ownerIndex = callbackOwnerIndexes.get(key);
			const source = target[key] as ArrayMethod;

			method = (...args: unknown[]): unknown => {
				this.#consume(collectionKey);

				if (ownerIndex === 2 && typeof args[0] === "function") {
					const callback = args[0] as ArrayMethod;

					if (args[1] === undefined) {
						args[0] = (value: unknown, index: unknown): unknown => callback(value, index, receiver);
					} else {
						args[0] = function (this: unknown, value: unknown, index: unknown): unknown {
							return callback.call(this, value, index, receiver);
						};
					}
				} else if (ownerIndex === 3 && typeof args[0] === "function") {
					const callback = args[0] as ArrayMethod;

					args[0] = (previous: unknown, value: unknown, index: unknown): unknown => {
						return callback(previous, value, index, receiver);
					};
				}

				return Reflect.apply(source, target, args);
			};

			methods.set(key, method);
		}

		return method;
	}

	#setIndex(target: ArrayTarget<Value>, key: Key, index: number, value: unknown): boolean {
		if (Object.is(target[index], value) && Object.hasOwn(target, key)) {
			return true;
		}

		const extendsArray = index >= target.length && index < 4_294_967_295;

		target[index] = value as Value;

		this.#dirty(index);
		this.#dirty(collectionKey);

		if (extendsArray) {
			this.#dirty("length");
		}

		return true;
	}

	#setLength(target: ArrayTarget<Value>, value: unknown): boolean {
		const oldLength = target.length;

		target.length = value as number;

		const length = target.length;

		if (length !== oldLength) {
			this.#dirty("length");
			this.#dirty(collectionKey);

			if (length < oldLength) {
				this.#dirtyTail(length);
			}
		}

		return true;
	}

	#dirtyTail(length: number): void {
		if (this.#signals === undefined) {
			return;
		}

		for (const key of this.#signals.keys()) {
			if (typeof key === "number" && key >= length) {
				this.#dirty(key);
			}
		}
	}
}

const collectionMethods = new Set<Key>([
	Symbol.iterator,
	"concat",
	"entries",
	"every",
	"filter",
	"find",
	"findIndex",
	"findLast",
	"findLastIndex",
	"flat",
	"flatMap",
	"forEach",
	"includes",
	"indexOf",
	"join",
	"keys",
	"lastIndexOf",
	"map",
	"reduce",
	"reduceRight",
	"slice",
	"some",
	"toReversed",
	"toSorted",
	"toSpliced",
	"values",
	"with",
]);
const callbackOwnerIndexes = new Map<Key, number>([
	["every", 2],
	["filter", 2],
	["find", 2],
	["findIndex", 2],
	["findLast", 2],
	["findLastIndex", 2],
	["flatMap", 2],
	["forEach", 2],
	["map", 2],
	["reduce", 3],
	["reduceRight", 3],
	["some", 2],
]);
const collectionKey = Symbol();

type ArrayMethod = (...args: unknown[]) => unknown;
type Key = number | string | symbol;
type ArrayTarget<Value> = Value[] & Record<Key, unknown>;

/** The native Array interface implemented by {@link SignalArray}. */
export interface SignalArray<Value = unknown> extends Array<Value> {}
