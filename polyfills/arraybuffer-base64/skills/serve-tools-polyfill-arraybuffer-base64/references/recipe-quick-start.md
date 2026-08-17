# Recipe: quick start

This public-import example is generated from the compile-checked `test/polyfill-arraybuffer-base64.recipes.ts` fixture in the package source.

```ts
import "@serve-tools/polyfill-arraybuffer-base64/runtime/node";

/** A compile-tested recipe for URL-safe base64 without padding. */
export function encodeIdentifier(bytes: Uint8Array): string {
	return bytes.toBase64({ alphabet: "base64url", omitPadding: true });
}
```
