const Composite = (<const T extends object>(source: T, options: CompositeOptions | undefined = undefined) => {
	assert("requires an object", source === object(source));

	if (weakSetHas.call(composites, source)) {
		return source;
	}

	assert("options must be an object", options !== null);

	const preserveNegativeZero = options?.preserveNegativeZero;
	const keys: string[] = [];
	const values = objectCreate(null);
	const sourceKeys = reflectOwnKeys(source);

	for (let index = 0; index < sourceKeys.length; ++index) {
		const key = sourceKeys[index]!;

		if (!getOwnPropertyDescriptor(source, key)?.enumerable) {
			continue;
		}

		assert("enumerable key must be a string", typeof key === "string");

		keys[keys.length] = key;

		const value = (source as Record<string, unknown>)[key];

		values[key] =
			// biome-ignore lint/suspicious/noSelfCompare: NaN is the only JavaScript value not equal to itself.
			typeof value === "number" && value !== value
				? canonicalNaN
				: preserveNegativeZero || value !== 0
					? value
					: 0;
	}

	arraySort.call(keys);

	const live: WeakRef<object>[] = [];

	candidate: for (let index = 0; index < interned.length; ++index) {
		const ref = interned[index]!;
		const composite = weakRefDeref.call(ref);

		if (!composite) {
			continue;
		}

		live[live.length] = ref;

		const other = weakMapGet.call(compositeData, composite)!;

		if (other.keys.length !== keys.length) {
			continue;
		}

		for (let keyIndex = 0; keyIndex < keys.length; ++keyIndex) {
			const key = keys[keyIndex]!;

			if (key !== other.keys[keyIndex] || !objectIs(values[key], other.values[key])) {
				continue candidate;
			}
		}

		return composite;
	}

	const composite = objectCreate(null);

	for (let index = 0; index < keys.length; ++index) {
		const key = keys[index]!;

		composite[key] = values[key];
	}

	objectFreeze(composite);

	weakSetAdd.call(composites, composite);
	weakMapSet.call(compositeData, composite, { keys, values });

	live[live.length] = new WeakReference(composite);

	interned = live;

	return composite;
}) as CompositeConstructor;

const isComposite = (value: unknown): value is Composite => weakSetHas.call(composites, value as object);

export { Composite };

// #region Types

export interface CompositeConstructor {
	<const Source extends object>(
		source: Source & (Source[keyof Source] extends Primitive ? unknown : never),
		options?: CompositeOptions,
	): Composite<Mutable<Source>>;
	<Source extends object>(source: Source, options?: CompositeOptions): Composite<Source>;

	/** Returns whether a value is a composite. */
	readonly isComposite: (value: unknown) => value is Composite;
}

export type Composite<Source extends object = object> = object &
	(Source extends readonly (infer Element)[]
		? number extends Source["length"]
			? { readonly [index: number]: Element }
			: {
					readonly [Key in Exclude<keyof Source, keyof (readonly unknown[])>]: Source[Key];
				}
		: {
				readonly [Key in Exclude<keyof Source, symbol>]: Source[Key];
			});

type Mutable<Source> = { -readonly [Key in keyof Source]: Source[Key] };
type Primitive = bigint | boolean | null | number | string | symbol | undefined;

/** Options controlling how constituent values are canonicalized. */
export interface CompositeOptions {
	/** Preserve `-0` instead of normalizing it to `0`. */
	readonly preserveNegativeZero?: boolean;
}

// #endregion Types

// #region Internals

const assert: (message: string, test: boolean) => asserts test = (message, test) => {
	if (!test) {
		const error = new TypeErrorConstructor(`Composite ${message}`);

		captureStackTrace(error, Composite);

		throw error;
	}
};

const canonicalNaN = Number.NaN;

const TypeErrorConstructor = TypeError;
const object = Object;
const { create: objectCreate, freeze: objectFreeze, getOwnPropertyDescriptor, is: objectIs } = object;
const { ownKeys: reflectOwnKeys } = Reflect;
const arraySort = Array.prototype.sort;
const weakMapGet = WeakMap.prototype.get;
const weakMapSet = WeakMap.prototype.set;
const weakSetAdd = WeakSet.prototype.add;
const weakSetHas = WeakSet.prototype.has;
const WeakReference = WeakRef;
const weakRefDeref = WeakReference.prototype.deref;

const composites = new WeakSet<object>();
const compositeData = new WeakMap<object, { keys: string[]; values: Record<string, unknown> }>();

const { captureStackTrace = console.error } = Error as ErrorConstructor & {
	captureStackTrace?: (target: object, constructor?: Function) => void;
};

let interned: WeakRef<object>[] = [];

Object.defineProperty(Composite, "isComposite", {
	configurable: true,
	writable: true,
	value: isComposite,
});

declare var console: {
	error(...data: unknown[]): void;
};

// #endregion Internals
