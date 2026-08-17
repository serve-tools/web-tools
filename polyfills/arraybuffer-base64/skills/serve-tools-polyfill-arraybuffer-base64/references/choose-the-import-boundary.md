# Choose the import boundary

Import `@serve-tools/polyfill-arraybuffer-base64/runtime/node` once from application-owned Node.js startup code before modules that call `Uint8Array.prototype.toBase64`.

Use `@serve-tools/ponyfill-arraybuffer-base64/runtime/node` instead when library code should encode bytes without modifying shared prototypes.

Do not import the Node.js runtime into browser code.
