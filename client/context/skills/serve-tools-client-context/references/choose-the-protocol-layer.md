# Choose the protocol layer

1. Use `createContext()` to associate a runtime key with its TypeScript value type.
2. Use `ContextProvider` and `ContextConsumer` for owned lifecycle, updates, cancellation, and late-registration behavior.
3. Use `ContextRequestEvent` and `ContextProviderEvent` directly when building another protocol-compatible abstraction.
4. Attach a `ContextRoot` near application startup when independent subscribing consumers can connect before their providers.
