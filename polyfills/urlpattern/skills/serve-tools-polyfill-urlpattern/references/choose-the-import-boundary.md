# Choose the import boundary

- Import `@serve-tools/polyfill-urlpattern` when code expects `globalThis.URLPattern` to exist.
- Import `@serve-tools/polyfill-urlpattern/apply/URLPattern` when global installation should use the explicit selective entrypoint.
- Import `URLPattern` from `@serve-tools/polyfill-urlpattern/URLPattern` to select the native constructor or fallback without global mutation.
- Import `URLPattern` from `@serve-tools/ponyfill-urlpattern` when the fallback implementation itself is required.
- Load the polyfill before modules that read `globalThis.URLPattern` during initialization.
- Existing native constructors remain unchanged.
