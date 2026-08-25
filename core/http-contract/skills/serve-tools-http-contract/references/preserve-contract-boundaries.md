# Preserve HTTP contract boundaries

- Keep one executable application contract in a trusted server module, and import it from browser code only with `import type`.
- Treat `@serve-tools/router` as the owner of route syntax, typed params/search, URL creation, and trusted route matching.
- Use `serialization: "native"` only for router’s built-in string, safe-integer, and identity enum wire forms.
- For a custom router codec, declare `serialization: "href"` and supply a URL from an explicitly browser-safe route module’s `href()` method.
- Declare public request and response schemas explicitly; never expose database tables, ORM schemas, migrations, internal timestamps, secrets, or authorization state by implication.
- Give every operation a successful 2xx response and only use `null` for a bodyless 204 or 205 response.
- Keep shared `commonResponses` limited to declared 4xx/5xx public envelopes, and do not replace an operation-specific status with a merely similar validator.
- Authorize in application context before reading a request body; route parameters and TypeScript types are never proof of access.
- Treat `isStatus()` as status-and-response-kind narrowing, not browser-side payload validation; preserve unexpected HTTP responses as their actual numeric status and native `Response`.
- Generate OpenAPI only as an explicit application-owned projection, and require Standard JSON Schema conversion only at that boundary.
- Do not infer authentication schemes, permissions, storage metadata, or a public documentation endpoint from an HTTP contract.
