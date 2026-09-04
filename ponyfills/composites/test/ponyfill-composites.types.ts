import type { CompositeOptions, Composite as CompositeType } from "@serve-tools/ponyfill-composites";
import { Composite } from "@serve-tools/ponyfill-composites";
import { expectTypeOf } from "vitest";

const symbol = Symbol("ignored");
const inferred = Composite({ hello: "world" });
const composite = Composite({ count: 1, label: "one", [symbol]: true } as const);

expectTypeOf(inferred).toEqualTypeOf<CompositeType<{ hello: "world" }>>();
expectTypeOf(inferred.hello).toEqualTypeOf<"world">();
expectTypeOf(composite.count).toEqualTypeOf<1>();
expectTypeOf(composite.label).toEqualTypeOf<"one">();
expectTypeOf<CompositeOptions>().toEqualTypeOf<{ readonly preserveNegativeZero?: boolean }>();

// @ts-expect-error Symbol keys are not present on composites.
composite[symbol];
// @ts-expect-error Composite properties are shallowly readonly.
composite.count = 2;

const nested = { mutable: true };
Composite({ nested }).nested.mutable = false;
Composite({ nested: { mutable: true } }).nested.mutable = false;

const tuple = Composite(["first", "second"] as const);
expectTypeOf(tuple[0]).toEqualTypeOf<"first">();
// @ts-expect-error Array length is not an enumerable own property.
tuple.length;
// @ts-expect-error Composites do not inherit the Array iterator.
tuple[Symbol.iterator];

const array = Composite(["first", "second"]);
expectTypeOf(array[0]).toEqualTypeOf<string>();
// @ts-expect-error Array methods are inherited rather than own enumerable properties.
array.map;

const value: unknown = composite;

if (Composite.isComposite(value)) {
	expectTypeOf(value).toMatchTypeOf<CompositeType>();
}

// @ts-expect-error Composite requires an object source.
Composite(null);
// @ts-expect-error Composite is callable but not constructible.
new Composite({ value: 1 });
