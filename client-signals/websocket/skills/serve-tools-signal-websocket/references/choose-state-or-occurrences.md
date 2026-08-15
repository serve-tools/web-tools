# Choose state or occurrences

Use `observe()` when a consumer needs the latest subscription value represented as explicit lifecycle state.
Signal propagation may coalesce intermediate values, so use `client.subscribe()` when every occurrence must be processed.
Dispose an observation when its owner ends to unsubscribe deterministically.
