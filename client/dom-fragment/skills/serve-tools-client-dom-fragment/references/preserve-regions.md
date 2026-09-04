# Preserve regions

Create `PersistentFragment` from existing nodes or a native `DocumentFragment`.
Use `insertBefore(parent, reference)` to insert or move it, and omit the reference to append.
Use `hidden` to preserve its position while parking content, or `remove()` to detach it for reuse elsewhere.

Read `nodes` when you need a fresh snapshot; it is not a mutable backing collection.
Nested fragments and changes between the boundary comments remain part of the region.
When reconciling nodes, use `PersistentFragment.fromNode(node)` to recognize a nested start boundary and remove its complete region instead of dismantling its boundaries.
The same lookup recognizes active hidden storage, but does not recognize arbitrary descendants or end boundaries.
Do not remove or reorder the boundaries, or replace an ancestor's contents while intending to reuse the region.

Keep application cleanup explicit: hiding and removing preserve subscriptions and listeners.
Native disconnection can change focus and invokes custom-element callbacks.
Defer mutations and `nodes` reads of the same fragment from those callbacks until its current operation returns.
Pass an explicit owner document when constructing outside the main document.
