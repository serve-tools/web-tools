# Preserve the ponyfill boundary

- Import `URLPattern` from `@serve-tools/ponyfill-urlpattern` when matching must not modify global state.
- Use the imported constructor directly rather than reading or assigning `globalThis.URLPattern`.
- Treat the ponyfill constructor as distinct from a native global constructor.
- Use `@serve-tools/polyfill-urlpattern` only when global installation is explicitly required.
- Import `URLPatternInput`, `URLPatternOptions`, `URLPatternInit`, `URLPatternResult`, and `URLPatternComponentResult` from the same package when explicit types are useful.
