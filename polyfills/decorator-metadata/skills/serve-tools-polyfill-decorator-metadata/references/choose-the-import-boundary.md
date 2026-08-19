# Choose the import boundary

- Import the package root for its side effect when transformed decorators expect global `Symbol.metadata`.
- Import `./apply/Symbol/metadata` when an explicit selective installer makes the mutation clearer.
- Import `metadata` from `./Symbol/metadata` for native-first symbol selection without global mutation.
- Import from `@serve-tools/ponyfill-decorator-metadata` only when producers and consumers intentionally share its module-scoped symbol.
