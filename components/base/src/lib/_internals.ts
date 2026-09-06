export const defineStringTag = <T>(constructor: { prototype: T }, value: string): T =>
	Object.defineProperty(constructor.prototype, Symbol.toStringTag, {
		configurable: true,
		value,
	});
