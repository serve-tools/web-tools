# Preserve identity and selection

- Context keys compare with strict equality.
- Use unique symbols or objects for private identity and strings or `Symbol.for()` for intentionally shared identity.
- Keep provider listeners non-capturing so bubbling selects the nearest matching ancestor.
- Do not add multiple active providers for the same key to one element.
- Qualify structural events by their complete protocol shape rather than event class identity.
