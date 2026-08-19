# Recipe: quick start

This public-import example is generated from the compile-checked `test/ponyfill-decorator-metadata.recipes.ts` fixture in the package source.

```ts
import { metadata } from "@serve-tools/ponyfill-decorator-metadata";
import { metadata as focusedMetadata } from "@serve-tools/ponyfill-decorator-metadata/lib/Symbol/metadata";

/** Stores metadata under the module-scoped key without modifying `Symbol.metadata`. */
export class MetadataCarrier {
	static [metadata]: Record<PropertyKey, unknown> = { component: true };
}

export const component = MetadataCarrier[focusedMetadata].component;
```
