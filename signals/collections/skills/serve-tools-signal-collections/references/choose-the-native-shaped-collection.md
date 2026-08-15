# Choose the native-shaped collection

- Use `SignalArray` when index, length, and whole-collection reads should invalidate independently.
- Use `SignalMap` when key presence, key values, structure, and content iteration need separate dependencies.
- Use `SignalSet` when membership and collection-wide reads need reactive invalidation.
- Use `SignalObject` for a shallow signal-backed plain record; use `SignalObject.fromEntries()` for entry-based construction.
