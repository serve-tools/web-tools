import { describe, expect, it } from "vitest";
import { metadata as focusedMetadata } from "../src/lib/Symbol/metadata.js";
import { metadata } from "../src/ponyfill-decorator-metadata.js";

describe("decorator metadata ponyfill", () => {
	it("exports one stable symbol from the root and focused entrypoints", () => {
		expect(metadata).toBeTypeOf("symbol");
		expect(metadata.description).toBe("Symbol.metadata");
		expect(focusedMetadata).toBe(metadata);
	});

	it("does not use or modify the global Symbol.metadata property", () => {
		const globalMetadata = Reflect.get(Symbol, "metadata");

		expect(metadata).not.toBe(globalMetadata);
		expect(Reflect.get(Symbol, "metadata")).toBe(globalMetadata);
	});

	it("can key metadata shared by explicit importers", () => {
		class Example {
			static [metadata] = { component: true };
		}

		expect(Example[focusedMetadata]).toEqual({ component: true });
	});
});
