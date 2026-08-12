import type { PropertyDeclaration } from "lit";

export type { PropertyDeclaration } from "lit";

export const initializeDecorator = <Value>(
	metadata: DecoratorMetadataObject | undefined,
	name: string | symbol,
	options: PropertyDeclaration<Value, unknown>,
): void => {
	let properties = litPropertyMetadata.get(metadata);

	if (properties === undefined) {
		litPropertyMetadata.set(metadata, (properties = new Map()));
	}

	properties.set(name, options);
};

/** Metadata for signal element properties. */
const litPropertyMetadata = ((globalThis as any).litPropertyMetadata ??= new WeakMap());

export type ReactiveElement = {
	requestUpdate(
		/** Represents the name of the requesting property. */
		name?: PropertyKey,

		/** Represents the old value of the requesting property. */
		oldValue?: unknown,

		/** Represents the property options to use instead of the previously configured options */
		options?: PropertyDeclaration,

		/** Represents whether the newValue argument is used instead of reading the property value. */
		useNewValue?: boolean,

		/** Represents the new value of the property. This is only used if `useNewValue` is true. */
		newValue?: unknown,
	): void;
};
