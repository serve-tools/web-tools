# Own a template

Import `html`, `scopedHtml`, and, when needed, `PersistentFragment` from `@serve-tools/aui/template`, a compatibility re-export of `@serve-tools/signal-dom/template`.
Use `scopedHtml(this)` synchronously inside `AUIElement.layout()` for managed rendering; it requires an active binding capture and is not available from `connect()` or asynchronous callbacks.
Capture writes initial values without subscribing; connect/resume starts observation and force-reconciles current values, and disconnect stops it without replacing nodes.
Instance listeners and directives survive disconnect, while explicit `view.dispose()` or a later layout failure retires them.
An unchanged handler does not rearm a consumed `once` listener on reconnection.
Use standalone `html(owner)` for intentionally persistent observation; it ignores ambient capture, including inside layout.
Call `html(owner)` as a tag with a stable object owner; DOM owners use their document, or pass an explicit document as the second argument.
The tag returns a `TemplateFragment`, a native `DocumentFragment` carrying an idempotent `dispose()` method.
Appending it transfers its children, so retain the returned handle for cleanup.

Use `${value}` for child values, `name=${value}` for a whole attribute, `.property=${value}` for a property, `@event=${handler}` for a listener, and `${directive}` in an opening tag for a synchronous element modifier.
State and Computed values bind reactively; plain values are written once.
Only `null` removes an attribute; use `.disabled=${boolean}` for boolean DOM properties.
Function event handlers receive the owner as `this`; listener objects receive their own `handleEvent` call.
Attach `capture`, `once`, `passive`, or `signal` to the function or listener object for native listener options.
Changing the handler with unchanged options updates the existing listener; it does not rearm an already consumed `once` listener or an aborted signal.

Templates trim leading/trailing source whitespace.
Use whole attribute values rather than mixed text such as `title="Hello ${name}"`.
Interpolations in raw-text elements, comments, nested template content, and tag names are unsupported and rejected before bindings start.
Do not treat the parser as a full Lit implementation, HTML sanitizer, or scoped-custom-element registry implementation.
Author template structure yourself; dynamic text is inserted as text, but assigning `.innerHTML` or another sensitive property retains the native sink's security requirements.

Standalone bindings and instance-owned listeners remain active during removal, hiding, and movement.
Managed bindings stop when the enclosing scope suspends, including hidden content; hiding a region alone does not suspend them.
Keep document/window observers and other connection resources in the existing connection lifecycle.
Retire a persistent template with `view.dispose()`; stopping its effects also suppresses already queued updates.
Weak owner scheduling avoids an extra global strong owner list, but externally retained signals or handles may retain the owner.
Do not rely on garbage collection as deterministic cleanup.

Directives receive an `Element` and may return one synchronous cleanup function.
Cleanup runs in registration order, continues after errors, and reports one original error or an `AggregateError` for several failures.
Setup failure cleans up previously acquired resources; a directive must clean its own partial acquisition if it throws before returning cleanup.
Disposal during setup stops later bindings and immediately runs any cleanup returned afterward.
Promise-returning directives are rejected; asynchronous work must implement its own cancellation and cannot be rolled back automatically.

Use `PersistentFragment` for reusable multi-node children, especially reordered or temporarily removed rows.
Use this entrypoint's re-export or the same installed `@serve-tools/client-dom-fragment` instance; regions from a second package copy are not recognized as reusable regions.
Ordinary document fragments are one-shot inputs.
Iterables are snapshotted before moving their nodes; this is replacement/movement, not keyed reconciliation.
Node identity and DOM-owned values survive, but native detach/insert can still affect focus, selection, and custom-element callbacks.
Do not remove the renderer's text/comment boundaries independently.
The parent template does not automatically own separately created child templates, including hidden children; register their disposal explicitly in an owning directive.
