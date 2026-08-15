# Preserve identity and syntax boundaries

- Keep side-effect imports intact.
  The package intentionally declares `sideEffects: true`.
- Preserve native implementations and fill only missing globals.
- Use the globally compatible disposal symbols so resources interoperate with native `using` when the compiler and runtime support the syntax.
- Do not claim that this package transforms `using` or `await using`; syntax support is a separate compiler/runtime concern.
- Keep installer dependency ordering correct: constructors and `SuppressedError` depend on the relevant disposal symbols.
