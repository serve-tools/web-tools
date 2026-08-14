---
name: serve-tools-client-context
description: Use @serve-tools/client-context for interoperable web-component context events, providers, consumers, late provider registration, subscription takeover, cancellation, fallback, and explicit topology refresh. Do not use it as a general state-management or dependency-injection container.
---

# Use @serve-tools/client-context

## Choose the protocol layer

1. Use `createContext()` to associate a runtime key with its TypeScript value type.
2. Use `ContextProvider` and `ContextConsumer` for owned lifecycle, updates, cancellation, and late-registration behavior.
3. Use `ContextRequestEvent` and `ContextProviderEvent` directly when building another protocol-compatible abstraction.
4. Attach a `ContextRoot` near application startup when independent subscribing consumers can connect before their providers.

## Preserve identity and selection

- Context keys compare with strict equality.
- Use unique symbols or objects for private identity and strings or `Symbol.for()` for intentionally shared identity.
- Keep provider listeners non-capturing so bubbling selects the nearest matching ancestor.
- Do not add multiple active providers for the same key to one element.
- Qualify structural events by their complete protocol shape rather than event class identity.

## Own lifecycle explicitly

- Call `connect()` and `disconnect()` from the corresponding custom-element callbacks.
- Call `refresh()` from `connectedMoveCallback()` after state-preserving moves and after relevant topology changes that do not reconnect the consumer.
- Replace the current subscription before releasing the previous provider.
- Keep cancellation idempotent and remove pending misses when owned consumers disconnect.
- Expect one-time misses to end synchronously; only subscribing misses are retained by `ContextRoot`.

## Scale coordination deliberately

- Prefer one shared root per document or one explicitly owned root per isolated boundary.
- Install a root before independent consumers connect when provider-late registration must work across implementations.
- Rely on context-indexed announcement replay rather than DOM-wide mutation observation.
- Destroy explicitly owned roots when their application lifetime ends.

## Validate changes

Update runtime behavior, declarations, README examples, browser tests, type fixtures, exports, and package shape together.
Test synchronous hits and misses, strict identity, nearest-provider selection, duplicate subscriptions, stable cancellation, late providers, takeover, fallback, reconnection, explicit moves, malformed events, callback failure isolation, and structural interoperability.
