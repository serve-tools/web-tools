# Use the local scheduler deliberately

1. Import `requestIdleCallback` and `cancelIdleCallback` from the package root or one explicit `runtime/*` export.
2. Keep each returned numeric handle paired with the same scheduler's `cancelIdleCallback`; root and `lib/*` imports share one browser cancellation domain, while each runtime export owns another.
3. Break long work into small units and consult `deadline.timeRemaining()` or `didTimeout`.
