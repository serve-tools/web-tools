# `@serve-tools/polyfill-arraybuffer-base64`

Installs `Uint8Array.prototype.toBase64()` in Node.js when the runtime does not provide it.

Turn binary bytes into text for a URL token or a JSON payload.
Use the [matching ponyfill](../../ponyfills/arraybuffer-base64/) for an explicit function import without changing prototypes.

## Install

```shell
npm install @serve-tools/polyfill-arraybuffer-base64
```

## Node.js

Import the runtime once from application-owned startup code:

```js
import "@serve-tools/polyfill-arraybuffer-base64/runtime/node";

const encoded = new Uint8Array([251, 255]).toBase64({
	alphabet: "base64url",
	omitPadding: true,
});
console.log(encoded); // "-_8"
```

The runtime preserves an existing native `Uint8Array.prototype.toBase64` implementation.
Browser runtimes are intentionally not exported yet.
