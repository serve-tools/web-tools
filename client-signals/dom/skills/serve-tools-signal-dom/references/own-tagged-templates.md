# Own tagged templates

Import `html`, `createFragment`, and `PersistentFragment` from `@serve-tools/signal-dom/template`, not the main functional-template entrypoint.
Bare `html\`...\``returns an inert`TemplateResult`.
Call`createFragment(result, owner, ownerDocument?)`to create a native`TemplateFragment`with idempotent`dispose()`; retain that handle after appending its children.

`createFragment()` chooses its observation lifetime from the current context.
Inside `scope.capture()`, capture writes initial values without subscribing, `resume()` starts observation and reconciles current values, and `suspend()` stops observation synchronously.
Outside capture, the fragment observes immediately and remains active while detached, hidden, or moved until disposed.

Suspending a managed view preserves DOM, event listeners, and directive setup.
`scope.dispose()`, `view.dispose()`, or capture rollback retires managed template resources; disposal does not remove DOM or own separately created fragment instances automatically.
Keep external subscriptions and document resources in an explicit connected interval, not in permanent directive setup.
Weak scheduling does not guarantee that external signals or stop handles cannot retain a view.

Use child `${value}`, whole `name=${value}`, `.property=${value}`, `@event=${handler}`, and opening-tag `${directive}` holes.
State and Computed values update asynchronously after their initial synchronous write.
Only `null` removes an attribute; boolean state usually belongs in a property such as `.disabled`.
Function handlers receive the owner as `this`; objects receive their own `handleEvent` call.
Listener options live on the function/object; unchanged options do not rearm consumed `once` listeners or aborted signals, including on managed resume.

Directives receive an Element and return synchronous cleanup or nothing.
Their cleanup runs in registration order, continues after errors, and is idempotently drained on disposal.
A throwing directive must release any partial acquisition it has not yet returned.
Promises are rejected; asynchronous work must supply its own cancellation.
Disposal during setup prevents later bindings and immediately runs cleanup returned afterward.

The grammar trims boundary whitespace and rejects mixed attributes, raw-text/comment holes, dynamic tag names, and nested template-content holes before setup.
It is not full Lit, a sanitizer, or a scoped custom-element registry implementation.
Child strings remain text; sensitive properties such as `.innerHTML` still need safe inputs.

Nested `html` descriptions work in child values, including signal and iterable children.
An active nested view follows descriptor identity through iterable reordering; removing or replacing its descriptor retires it promptly.
Use this subpath's `PersistentFragment` re-export for reusable multi-node rows that must remain owned while parked, hidden, or restored.
Regions from a second package copy are not recognized; ordinary DocumentFragments remain one-shot inputs.
Iterables are snapshotted before moving nodes, and nested descriptions reconcile by descriptor identity rather than a value key.
Keep renderer boundaries intact and explicitly own separately created fragment instances.
Native moves may affect focus, selection, and custom-element callbacks even when node identity survives.

`html(owner)` and `scopedHtml(owner)` remain deprecated compatibility tags.
Do not use them in new code.
