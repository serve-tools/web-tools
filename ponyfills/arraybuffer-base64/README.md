# `@serve-tools/ponyfill-arraybuffer-base64`

Encodes `Uint8Array` values with the `Uint8Array.prototype.toBase64()` contract in Node.js without modifying globals.

## Install

```shell
npm install @serve-tools/ponyfill-arraybuffer-base64
```

## Node.js

```js
import { toBase64 } from "@serve-tools/ponyfill-arraybuffer-base64/runtime/node";

const standard = toBase64(new Uint8Array([251, 255]));
const urlSafe = toBase64(new Uint8Array([251, 255]), {
	alphabet: "base64url",
	omitPadding: true,
});
```

The runtime accepts only `Uint8Array` instances, including subclasses and Node.js `Buffer` values.
It preserves the selected view's byte offset and length.

Browser runtimes are intentionally not exported yet.
