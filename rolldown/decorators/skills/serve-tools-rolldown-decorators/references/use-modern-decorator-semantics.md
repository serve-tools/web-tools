# Use modern decorator semantics

Write decorators using `(value, context)`, where `context.kind` identifies a class, field, method, getter, setter, or accessor.
Use `context.addInitializer()` for work tied to class or instance initialization and `context.access` for proposal-defined member access.

A field decorator may return an initializer function.
A method, getter, or setter decorator may return a replacement function.
An auto-accessor decorator may return an object containing `get`, `set`, or `init` replacements.
A class decorator may return a replacement class.

Do not use legacy target/prototype/property-key decorator signatures.
Do not enable TypeScript `experimentalDecorators`; those semantics are intentionally unsupported.

The package runtime uses `@serve-tools/polyfill-decorator-metadata` to preserve a native `Symbol.metadata` or install the proposal symbol when it is missing, then publishes each decorated class's shared metadata object there.
