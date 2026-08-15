# Use the local scheduler deliberately

1. Import `requestIdleCallback` and `cancelIdleCallback` from the package root.
2. Keep each returned numeric handle paired with this package's `cancelIdleCallback`; root and `lib/*` imports share one cancellation domain.
3. Break long work into small units and consult `deadline.timeRemaining()` or `didTimeout`.
