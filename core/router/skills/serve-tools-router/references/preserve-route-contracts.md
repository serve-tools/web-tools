# Preserve route contracts

- Keep route declarations unnamed so the route object remains the shared identity.
- Treat `match.path` as the declared path template, not the destination pathname; equal templates cannot distinguish different route identities or codecs.
- Require native `URLPattern`, or install an application-owned global polyfill explicitly before creating routes.
- Treat undeclared pathname parameters as strings and apply the same `codec` declarations symmetrically in `href()` and `match()`.
- Restrict pathname parameters to required single-value codecs; use `.optional()`, `.default(value)`, and `.many()` only for search parameters.
- Expect required or invalid search values and duplicate scalar keys to make `match()` return `null`.
- Expect `.many()` search codecs to preserve repeated values in order and default to an empty array.
- Expect a custom default to snapshot its formatted wire value and parse a fresh match value whenever the search key is omitted.
- Treat `codec.metadata` as the portable integration boundary: built-in string, integer, and enum codecs report `native: true`, while arbitrary `codec.schema()` codecs and their derivatives report `native: false`.
- Use metadata from the codecs retained in `route.options`; do not infer custom-schema compatibility from a parsed example value.
- Treat `route.options` and its `params`, `search`, and `loading` members as frozen shallow snapshots; mutating caller-owned option objects after declaration does not alter route behavior.
- Reject adjacent pathname parameters as intrinsically ambiguous, while preserving pathname parameters separated by literal affixes such as `:id.:format-:variant`.
- Expect `href()` to reject a pathname codec value unless matching the generated URL reproduces the same formatted wire value.
- Reject empty standalone pathname values, `.` or `..` standalone parameter values, and non-well-formed Unicode in `href()` while preserving literal-affix parameters.
- Keep `loading.mode` portable: `blocking` waits for data, while `deferred` lets an integration render before data settles.
- Pass the integration-owned cancellation signal to `loading.load()` and do not invoke loaders from the shared route declaration package.
