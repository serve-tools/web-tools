# Choose the import boundary

Import `@serve-tools/ponyfill-arraybuffer-base64/runtime/node` when the caller should explicitly encode a `Uint8Array` without changing `Uint8Array.prototype`.

Use `@serve-tools/polyfill-arraybuffer-base64/runtime/node` instead when application-owned Node.js startup code should install `Uint8Array.prototype.toBase64` for downstream code.

Do not import either Node.js runtime into browser code.
