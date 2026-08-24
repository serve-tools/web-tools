import type { ComplexAttributeConverter } from "lit";

/** Lit-compatible default conversion between attribute strings and property values. */
export const defaultAttributeConverter: ComplexAttributeConverter<unknown, TypeHint> = {
	/** Converts an attribute string into a property value using its constructor hint. */
	fromAttribute(value, type): unknown {
		switch (type) {
			case Array:
			case Object:
				try {
					return value === null ? null : JSON.parse(value);
				} catch {
					return null;
				}
			case Boolean:
				return value !== null;
			case Number:
				return value === null ? null : Number(value);
			default:
				return value;
		}
	},

	/** Converts a property value into an attribute string using its constructor hint. */
	toAttribute(value, type): string | null {
		switch (type) {
			case Array:
			case Object:
				return value == null ? null : JSON.stringify(value);
			case Boolean:
				return value ? "" : null;
			default:
				return value == null ? null : String(value);
		}
	},
};

// #region Types

/** Converts between an attribute value and a property value. */
export type AttributeConverter<Type = unknown, TypeHint = unknown> =
	| ComplexAttributeConverter<Type, TypeHint>
	| ((value: string | null, type?: TypeHint) => Type);

/** A constructor used as a conversion hint by {@link defaultAttributeConverter}. */
export type TypeHint = typeof String | typeof Number | typeof Boolean | typeof Object | typeof Array;

// #endregion Types
