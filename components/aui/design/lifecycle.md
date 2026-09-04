# AUI lifecycle decision

Status: implemented with adversarial browser coverage; the separate mount-performance and manual accessibility release gates remain open.

## Decision

Give each AUI element an explicit binding scope and a separate connection resource scope.
Build its layout once, retain the nodes and component state, and recreate only active effect controllers when the element reconnects.
Suspend subscriptions synchronously on a real disconnection.
Ordinary consumers do not call `destroy()` or `dispose()` to prevent retention after removal.

Add an opt-in `createBindingScope()` to Signal DOM.
Keep existing unscoped Signal DOM behavior and the effect package's terminal `start()`/`dispose()` contract unchanged.
The public scope surface is deliberately small:

```ts
interface BindingScope {
	capture<Build extends () => unknown>(
		build: ReturnType<Build> extends PromiseLike<unknown> ? never : Build,
	): ReturnType<Build>;
	resume(): boolean;
	suspend(): void;
	dispose(): void;
}
```

`capture()` records the binding's creator during synchronous construction and restores the previous capture scope in `finally`.
It does not propagate through a promise, timer, event, or other asynchronous boundary.
The type and runtime reject thenable results; rollback cannot cancel arbitrary asynchronous work already scheduled by the builder.
Capture is rejected while that scope is resuming or executing a binding, so it cannot recursively activate new records from a setter.
Nested AUI elements create their own scope.
Build the layout detached and commit it outside the capture context so another element's connection callbacks are not accidentally captured by its parent.
The base invokes layout after subclass initialization, not from its base constructor.

`resume()` creates a fresh effect for each live binding record, stores the controller before starting it, and synchronously reconciles current values.
It returns true only when activation completes or the scope is already active.
It returns false when activation cannot finish because capture, a setter, or another transition is running, or because the scope was suspended or retired during activation.
`suspend()` marks the scope inactive before stopping observation and drains every active controller.
`dispose()` permanently retires the records and is reserved for explicit terminal ownership and rollback.
An explicit Signal DOM `dispose(node)` also retires that node's scoped records; a later resume cannot resurrect them.

## Why recreate the controllers

Each retained binding is a setter closure, its owner, and its current controller slot.
The existing effect scheduler already batches invalidations, unwatches stopped effects, and skips disposed work in a queued flush.
Reusing this implementation avoids introducing another scheduler or changing effect semantics across unrelated consumers.

Reconnection necessarily reconciles bindings because signals or DOM may have changed while the element was detached.
A fresh effect performs that reconciliation even when the source signal's value is unchanged.
This reconciles values on retained binding targets, not arbitrary deletion or relocation of nodes within a binding-owned region.
It costs one new controller/computed pair per live binding per real reconnection.
Measure that cost before introducing reusable effect controllers.

| Alternative                                                     | Reason not selected                                                                                                |
| --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Keep bindings permanently active and require `destroy()`        | Ordinary removal can retain a component through external stores and listeners.                                     |
| Dispose the subtree on every disconnection                      | Disposal is terminal and destroys the ability to reuse the same bindings on reconnect.                             |
| Rebuild layout on reconnect                                     | Loses node identity, user editing state, native state, and author-owned content.                                   |
| Delay teardown by a microtask or timer                          | An already-queued flush may run first, and the retention guarantee becomes timing dependent.                       |
| Add restart semantics to the generic effect package immediately | Broadens the change and requires a new scheduler contract before a reconnect-allocation benefit has been measured. |
| Observe the whole document or rely on finalizers                | Adds global work or nondeterministic ownership to a lifecycle the platform already supplies.                       |

## Element state machine

| State         | Event                                         | Required result                                                                                                          |
| ------------- | --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Uninitialized | First valid connection                        | Build layout once, record bindings, commit owned nodes, and activate.                                                    |
| Inactive      | Connection                                    | Reconcile current bindings and start connection resources.                                                               |
| Active        | Real disconnection                            | Mark inactive first and synchronously release active subscriptions and resources.                                        |
| Active        | Connected move                                | Keep layout and observation; refresh ancestor-dependent relationships.                                                   |
| Either        | Document adoption                             | Release old-document resources, retain nodes/internals/state, and acquire resources for the new document when connected. |
| Either        | Terminal retirement or initialization failure | Release all owned work; never revive retired bindings.                                                                   |

`isConnected` is the source of truth, including custom-element reactions delivered after the DOM has already moved.
A remove followed by a later append is a suspend/resume cycle, even when both happen in one JavaScript turn.
Use `connectedMoveCallback()` when the platform and caller support a state-preserving move; do not require that newer API as part of the stated platform baseline.
Do not synthesize preservation of focus or top-layer state that the equivalent native DOM operation itself does not preserve.

A reconciliation guard and generation counter prevent nested activation.
If a setter removes the host, existing subscriptions stop synchronously and the interrupted activation cannot continue using a stale generation.
If it reconnects the host from inside the same setter, finish unwinding that setter before activating again.
The base schedules at most one microtask retry of an interrupted activation.
If that retry again changes connectivity during activation, leave the scope suspended and report the non-convergent lifecycle instead of looping indefinitely.
This deferral never delays disconnection cleanup.
Repeated lifecycle callbacks must not create a second active controller for a binding or duplicate a connection listener.

## Ownership and retention

Scopes own records created within their capture; they do not infer ownership by traversing the DOM.
This includes bindings inside hidden groups and closed shadow roots.
A conditional region's owner remains active while its host is connected, even while the region is hidden.
Nested custom elements that become detached suspend their own scopes independently.
Slot reassignment does not transfer ownership or authorize a parent to dispose the assigned nodes.

While connected, an external signal may reach a computed, its setter closure, and the component.
On disconnection, unwatch every computed and remove document/window listeners, observers, timers, context subscriptions, and other external registrations.
The remaining graph is owned by the detached host: scope, binding descriptions, retained nodes, and state.
There is no global strong registry and no path from an external store or connection resource back to that graph.
It is therefore collectible when the application drops the host, while an intentionally retained host can reconnect.
A disposed effect already present in the scheduler's current snapshot may remain reachable until that flush unwinds but must not run again.

Install an `AbortController` before invoking connection setup.
Register cleanup before acquiring a resource where possible.
If setup returns cleanup after a reentrant disconnection, invoke it immediately.
Aborting a connection must be paired with explicit cleanup for resources that do not accept AbortSignal.
Drain cleanup despite individual failures and report the original error or an aggregate rather than silently swallowing it.

## Native state and styles

Attach ElementInternals once and preserve its identity across connections.
Keep form value, validity, dirty/default state, and form callbacks independent from whether visual bindings currently observe signals.
Public setters and form operations must have their required synchronous native effects even while detached.

Use native dialog/popover operations and events for top-layer state.
Use CSS positioning without adding continuous geometry measurement to the base.
Allocate document-bound resources using the current `ownerDocument` and its `defaultView`.

Owned style nodes follow native document adoption without a stylesheet migration layer.
When sharing constructed stylesheets, use a per-Document weak cache and refresh adoption during connection setup.
The base does not promise to migrate arbitrary constructed stylesheets created by layout code.
Use scoped host CSS properties for per-instance reactive values.
Do not let one adopter own and suspend a shared reactive sheet's producer.
Existing Signal DOM `adoptedCSS()` has terminal ownership semantics and is not a shared reactive-sheet lease API.
If a shared reactive producer becomes a supported feature, give it explicit first-adopter/last-adopter lifetime tests rather than hiding it in the base element.

## Required proof

Test actual external signal sink counts and resource registrations, not only visible output.
The suite must cover dormant construction, synchronous first connection, queued invalidation before removal, detached updates, unchanged-value reconciliation, repeated reconnects, and terminal retirement.
It must also cover hidden groups, closed roots, nested capture, independently owned children, caller-owned slots, reentrant removal/reinsertion, adoption, initialization failure, and failures during activation and cleanup.
Compare native control and AUI event/state behavior where the component delegates to native APIs.

Disconnect work must be proportional to owned bindings and resources, with no DOM traversal.
Disconnected source updates must cause zero AUI binding work.
Reconnect work must be proportional to live owned bindings and resources and preserve node identity.
See [performance.md](performance.md) for the production comparison and retention experiment.
