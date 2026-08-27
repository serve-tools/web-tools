---
name: serve-tools-http-contract
description: Use @serve-tools/http-contract for APIs.
---

# Use @serve-tools/http-contract

Treat the installed package README and public declarations as the API source of truth.
Read only the reference needed for the current task.

## Route by task

- [Recipe: declare and call an API](references/recipe-quick-start.md): a type-checked contract and native Fetch client.
- Keep validators and the executable contract in trusted server modules; browser clients import the contract only with `import type`.
- Omit `route` for a literal or string-parameter path; provide a router route when typed codecs, search values, or `href` serialization are needed.
- Omitted `serialization` defaults to `"native"`; custom router codecs still require explicit `"href"` and a safe route module.
- Omit `operationId` unless external documentation or tooling needs a stable ID; the package never synthesizes one.
- `defineAPI()` materializes default `400` responses for URL decoding or JSON bodies and default `413`/`415` responses for JSON bodies; an operation or API-level response at the same status wins.
- Wrap a custom adapter-generated error with `adapterResponse(schema, ({ request, status }) => body)`; do not configure handler error-body maps.
- HTTP paths use complete literal or `:parameter` segments, not generic-router affixed parameters; same-method shadows are rejected unless native integer/enum metadata proves them disjoint.
- Use API-level `responses` only for shared 4xx/5xx envelopes; operation `responses` remains operation-specific, and an overlapping status must use the identical schema object.
- Use `composeAPIs(componentA, componentB)` to retain component-scoped API-level responses, or `composeAPIs({ responses }, componentA, componentB)` for envelopes shared by the final API, including adapter `404`/`405`; same-status globals override component schemas.
- Apply middleware responses to a component with `composeAPIs({ responses }, componentAPI)` before composing public siblings; browser types must use that exposed contract.
- Use `@serve-tools/http-contract/client/static` only when every selected native route is a fixed literal path without params or search values; otherwise use `/client`.
- Narrow browser results directly with `result.status === <declared status>`; every branch has `status`, literal `ok`, typed `body`, and native `response`, with `body: undefined` for 204/205.
- Put native per-request Fetch metadata in `init`; `method`, `body`, `mode: "no-cors"`, `Accept`, and `Content-Type` remain adapter-owned. Use the client's second generic only for typed framework RequestInit extensions; it also types injected `fetch` callback metadata as optional.
- Response media-type or JSON failures expose their source `Response` on `ProtocolError.response`.
- When migrating from 0.1, remove `isStatus`, read every declared result through `status` and `body`, and catch `ProtocolError` only when handling malformed or non-JSON responses; rethrow response-less native or local failures.
- The generic client can still receive proxy-produced valid JSON or bodyless 204/205 with an undeclared status because it does not ship contract status metadata.
- In server context, narrow on the literal `method` and `path` and return `respond({ status, body?, headers? })`; the branded result accepts only that operation's response pairs.
- When migrating server code from 0.1, replace `reject()` with the context's `respond(...)` and replace `errorBodies` handler options with contract-level `adapterResponse(...)` declarations.
- For the API-level response rename, replace `commonResponses` with `responses` and `APICommonResponses` with `APIResponses`; operation-level `responses` is unchanged.
- Handler and context response objects accept `headers: HeadersInit`, but `Content-Type`, `Content-Length`, `Content-Encoding`, and `Transfer-Encoding` remain adapter-owned.
- Combine component maps checked with `satisfies Handlers<typeof componentAPI>` by object spread into the composed handler map.
- Both client entrypoints export `ProtocolError`; `baseURL` resolves absolute paths against an origin and does not mount an API prefix.
- Derive OpenAPI only from public routes; optional operation summaries, descriptions, tags, deprecation, and security metadata plus closed projection options are emitted but never inferred.
- To preserve ownership and public-wire boundaries, read [Preserve HTTP contract boundaries](references/preserve-contract-boundaries.md).
