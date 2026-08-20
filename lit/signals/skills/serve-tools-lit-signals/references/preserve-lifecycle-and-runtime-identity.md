# Preserve lifecycle and runtime identity

- Signal-native template bindings, `watch()`, `when()`, `choose()`, `repeat()`, consumed context subscriptions, `SignalElement`, `SignalWatcher`, and `@style` remove subscriptions while their Lit owner is disconnected and restore them on reconnection.
- `@operation` disposes only its element-owned terminal subscription on disconnection and resubscribes to future ambient view values on reconnection; configure `disconnectDelay` only when brief disconnections should retain that subscription.
- `repeat()` requires unique stable keys for keyed lists, preserves keyed DOM across moves, and releases removed row dependencies immediately.
- Automatic effects clean up after a lasting disconnection and restart on reconnection; same-task DOM moves do not tear them down.
- A manually managed effect remains active while disconnected and therefore must always be explicitly disposed.
- Nested reactive directives remain fine-grained and do not become dependencies of their containing directive or component render.
- Import `Signal` and signal collections from `@serve-tools/lit-signals` to use the package's compatible implementations.
- Import event-target Signals from `@serve-tools/lit-signals`, but remember that their eager listeners are not owned by Lit connection lifecycle; dispose them explicitly or pass an external `AbortSignal`.
- Use direct event listeners instead of an event-target Signal when every occurrence or event payload must be processed.
- Keep signal collections shallow and preserve already-normalized collection identity when replacing an accessor value.
- Keep attribute-to-property conversion in Lit property metadata; use `defaultAttributeConverter` only when implementing compatible custom behavior.
