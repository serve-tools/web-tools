# Preserve behavior

The root and `./apply/Symbol/metadata` entrypoints preserve an existing `Symbol.metadata` and install the ponyfill symbol only when the property is missing.
The `./Symbol/metadata` entrypoint selects the native symbol first without changing globals.

Keep side-effect imports intact because the package intentionally declares `sideEffects: true`.
Load the installer before transformed decorator modules whose emitted runtime reads `Symbol.metadata`.

This package provides only the symbol key.
Do not claim that it transforms decorator syntax, creates `context.metadata`, attaches metadata to classes, or implements metadata inheritance.
