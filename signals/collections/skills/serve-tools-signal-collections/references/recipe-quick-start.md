# Recipe: quick start

This public-import example is generated from the compile-checked `test/signal-collections.recipes.ts` fixture in the package source.

```ts
import { Signal } from "@serve-tools/signal";
import { SignalMap, SignalObject } from "@serve-tools/signal-collections";

const users = new SignalMap<string, { name: string }>();
const filters = new SignalObject({ query: "" });
const selectedName = new Signal.Computed(() => users.get(filters.query)?.name);

users.set("ada", { name: "Ada" });
filters.query = "ada";

console.log(selectedName.get());
```
