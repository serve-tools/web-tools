# Choose the import boundary

- Import `@serve-tools/polyfill-urlpattern` when code expects `globalThis.URLPattern` to exist.
- Import its named `URLPattern` export when the application should use the same native-or-fallback constructor installed globally.
- Import `URLPattern` from `@serve-tools/ponyfill-urlpattern` when global mutation is not acceptable.
- Load the polyfill before modules that read `globalThis.URLPattern` during initialization.
- Existing native constructors remain unchanged.
