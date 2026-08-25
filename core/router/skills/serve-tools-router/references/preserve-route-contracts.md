# Preserve route contracts

- Keep route declarations unnamed so the route object remains the shared identity.
- Require native `URLPattern`, or install an application-owned global polyfill explicitly before creating routes.
- Treat undeclared pathname parameters as strings and apply the same `codec` declarations symmetrically in `href()` and `match()`.
- Restrict pathname parameters to required single-value codecs; use `.optional()`, `.default(value)`, and `.many()` only for search parameters.
- Expect required or invalid search values and duplicate scalar keys to make `match()` return `null`.
- Expect `.many()` search codecs to preserve repeated values in order and default to an empty array.
- Keep `loading.mode` portable: `blocking` waits for data, while `deferred` lets an integration render before data settles.
- Pass the integration-owned cancellation signal to `loading.load()` and do not invoke loaders from the shared route declaration package.
