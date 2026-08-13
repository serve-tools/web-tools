import { signalProxy } from "./signalProxy.js";

const instances = new WeakSet<object>();

/** A shallow signal-backed plain record constructor. */
export const SignalObject = Object.assign(
	function SignalObject(value: object = {}): object {
		const object = signalProxy({ ...value });

		instances.add(object);

		return object;
	},
	{
		/** Creates a shallow signal-backed plain record from key/value entries. */
		fromEntries: <Value = unknown>(entries: Iterable<readonly [PropertyKey, Value]>): { [key: string]: Value } =>
			signalProxy(Object.fromEntries(entries)) as { [key: string]: Value },
	},
) as unknown as {
	/** Creates a shallow signal-backed copy of a plain record. */
	new <Value extends object = Record<PropertyKey, unknown>>(value?: Value): Value;

	/** The prototype shared by SignalObject instances. */
	readonly prototype: SignalObject;

	/** Creates a shallow signal-backed plain record from key/value entries. */
	fromEntries: <Value = unknown>(entries: Iterable<readonly [PropertyKey, Value]>) => { [key: string]: Value };
};

Object.defineProperty(SignalObject, Symbol.hasInstance, {
	value: (value: unknown) => typeof value === "object" && value !== null && instances.has(value),
});

/** A shallow signal-backed plain record. */
export type SignalObject<Value extends object = Record<PropertyKey, unknown>> = Value;
