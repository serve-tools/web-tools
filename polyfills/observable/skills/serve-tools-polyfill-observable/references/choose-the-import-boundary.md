# Choose the import boundary

- Import `@serve-tools/polyfill-observable` when code expects the two global interface objects and `EventTarget.prototype.when()`.
- Import a documented `./apply/...` subpath when only that missing property should be installed.
- Import from `./Observable`, `./Subscriber`, or `./EventTarget/when` for native-aware selection without global mutation.
- Use `@serve-tools/ponyfill-observable` directly when the explicit cold fallback is required regardless of native availability.
- Load installers before modules that read the platform hooks during initialization.
- Treat the Observable, Subscriber, and EventTarget method as independent selections in partial native implementations.
- Existing non-null values remain unchanged and are not validated or repaired.
