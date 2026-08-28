# Own the element lifecycle

Importing AUI does not register custom elements.
Define application-chosen names explicitly with `customElements.define()`.

Build Signal DOM content synchronously in `layout(content)` using the supplied detached fragment.
Layout runs once after subclass initialization; reconnecting preserves nodes and reconciles the latest signal values.
The host is the default destination; override `createLayoutRoot()` for a shadow root without replacing author-provided light DOM.

The base owns the native connected, disconnected, moved, and adopted callbacks.
Use `connect(connection)` to start resources and `moved(connection)` to refresh ancestor-dependent relationships.
Replace previous ancestor subscriptions during a move instead of accumulating them in the same connection.
Use `connection.signal` for cancellable listeners or work, and `connection.addCleanup()` immediately after acquiring observers, timers, or subscriptions that do not accept a signal.
Setup is synchronous; asynchronous work must respect the supplied signal before applying results.

Do not require an application destructor for ordinary removal, rerun layout on reconnect, or dispose caller-owned slotted content.
Bindings built outside layout need their own explicit ownership.
Never share an instance-owned reactive stylesheet across independently connected components.
Owned style nodes follow document adoption; shared constructed sheets need a per-Document cache and reconnection setup.
Reconciliation updates retained binding targets, not arbitrary structural edits inside binding-owned regions.
The base supplies no server rendering, hydration, automatic property reflection, or form-control policy.
