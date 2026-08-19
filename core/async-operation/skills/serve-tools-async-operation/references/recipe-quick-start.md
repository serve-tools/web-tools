# Recipe: quick start

This public-import example is generated from the compile-checked `test/async-operation.recipes.ts` fixture in the package source.

```ts
import { AsyncOperation } from "@serve-tools/async-operation";

await using operation = new AsyncOperation<string, number>(async ({ signal, write }) => {
	if (signal.aborted) {
		throw signal.reason;
	}

	await write("connecting");
	await write("ready");

	return 2;
});

for await (const value of operation) {
	console.log(value);
}

console.log(await operation.result);
```
