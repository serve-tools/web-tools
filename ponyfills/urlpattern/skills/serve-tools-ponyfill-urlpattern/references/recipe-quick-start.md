# Recipe: quick start

This public-import example is generated from the compile-checked `test/ponyfill-urlpattern.recipes.ts` fixture in the package source.

```ts
import { URLPattern } from "@serve-tools/ponyfill-urlpattern";

/** A compile-tested recipe for matching a named URL pathname group. */
export function matchUserIdentifier(url: string): string | undefined {
	return new URLPattern({ pathname: "/users/:id" }).exec(url)?.pathname.groups.id;
}
```
