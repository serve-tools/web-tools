# Recipe: quick start

This public-import example is generated from the compile-checked `test/polyfill-decorator-metadata.recipes.ts` fixture in the package source.

```ts
import "@serve-tools/polyfill-decorator-metadata";
import { metadata } from "@serve-tools/polyfill-decorator-metadata/Symbol/metadata";

/** Stores metadata using both the installed global and the native-aware import. */
export class MetadataCarrier {
	static [Symbol.metadata]: Record<PropertyKey, unknown> = { installed: true };
}

export const installed = MetadataCarrier[metadata].installed;
```
