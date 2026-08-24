# Recipe: quick start

This public-import example is generated from the compile-checked `test/polyfill-urlpattern.recipes.ts` fixture in the package source.

```ts
import { URLPattern } from "@serve-tools/polyfill-urlpattern";

const pattern = new URLPattern({ pathname: "/books/:id" });

/** Matches a book URL after installing the native-aware global constructor. */
export function matchBook(input: string): string | undefined {
	const result = pattern.exec(input);

	return result?.pathname.groups.id;
}

/** Whether the exported constructor is the globally installed constructor. */
export const installed = globalThis.URLPattern === URLPattern;
```
