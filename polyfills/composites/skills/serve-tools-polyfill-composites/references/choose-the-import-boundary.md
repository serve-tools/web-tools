# Choose the import boundary

- Import `@serve-tools/polyfill-composites` when code expects `globalThis.Composite` to exist.
- Import `@serve-tools/polyfill-composites/apply/Composite` for the explicit global installer.
- Import `Composite` from `@serve-tools/polyfill-composites/Composite` for native-aware selection without global mutation.
- Import from `@serve-tools/ponyfill-composites` when the module-local fallback itself is required.
- Existing non-null global values remain unchanged and are not validated or repaired.
