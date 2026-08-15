# Recipe: quick start

This public-import example is generated from the compile-checked `test/client-interaction.recipes.ts` fixture in the package source.

```ts
import { openFiles, share, writeToClipboard } from "@serve-tools/client-interaction";

const files = await openFiles({
	multiple: true,
	types: [{ accept: { "image/png": [".png"] } }],
});

if (files.status === "completed") {
	await share({ files: files.value, title: "Selected images" });
}

const clipboard = await writeToClipboard({ "text/plain": "Copied with @serve-tools/client-interaction" });

if (clipboard.status === "failed") {
	console.error(clipboard.error);
}
```
