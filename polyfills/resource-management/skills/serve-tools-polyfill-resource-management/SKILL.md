---
name: serve-tools-polyfill-resource-management
description: Use @serve-tools/polyfill-resource-management when adding, reviewing, or debugging native-aware global Explicit Resource Management support, including Symbol.dispose, Symbol.asyncDispose, DisposableStack, AsyncDisposableStack, and SuppressedError. Covers root, selective installer, and mutation-free imports; do not use for module-scoped ponyfill symbols.
---

# Use @serve-tools/polyfill-resource-management

## Choose the import boundary

- Import the package root for side effects when every missing resource-management global should be installed.
- Import an `./apply/*` subpath when only selected globals should be installed.
- Import the matching top-level subpath when code needs the native implementation if present or the fallback otherwise without changing globals.
- Use `@serve-tools/ponyfill-resource-management` only when intentionally adopting its module-scoped symbols and non-native protocol.

## Preserve identity and syntax boundaries

- Keep side-effect imports intact.
  The package intentionally declares `sideEffects: true`.
- Preserve native implementations and fill only missing globals.
- Use the globally compatible disposal symbols so resources interoperate with native `using` when the compiler and runtime support the syntax.
- Do not claim that this package transforms `using` or `await using`; syntax support is a separate compiler/runtime concern.
- Keep installer dependency ordering correct: constructors and `SuppressedError` depend on the relevant disposal symbols.

## Validate changes

Test full installation, each selective installer, mutation-free subpaths, native-preservation behavior, and multiple-disposal failures.
Update declarations, README, type fixtures, runtime tests, and package shape together.
