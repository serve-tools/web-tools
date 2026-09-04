# @serve-tools/client-dom-fragment

A small, dependency-free persistent DOM fragment, based on the region behavior of `@serve-tools/signal-dom`'s `group()`.
Move, hide, restore, and detach the same nodes without a wrapper element or a signal runtime.

```ts
import { PersistentFragment } from "@serve-tools/client-dom-fragment";

const input = document.createElement("input");
const message = document.createTextNode("Your name");
const fragment = new PersistentFragment([message, input]);

fragment.insertBefore(document.body); // Append the region.
fragment.hidden = true; // Keep its position; park its contents.
fragment.hidden = false; // Restore the same input, value, and listeners.
fragment.remove(); // Detach for later reuse.
fragment.insertBefore(document.body);
```

## Install

```shell
npm install @serve-tools/client-dom-fragment
```

#### Import from a CDN

```js
import * as clientDomFragment from "https://esm.run/@serve-tools/client-dom-fragment";
```

## API

| Member                                           | Behavior                                                                                                           |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------ |
| `new PersistentFragment(nodes?, ownerDocument?)` | Creates a detached region from an iterable of nodes; defaults to an empty region in `document`.                    |
| `PersistentFragment.fromNode(node)`              | Returns the region for its start boundary or active hidden-storage fragment; otherwise returns `undefined`.        |
| `nodes`                                          | Returns a fresh array of current top-level content, including while hidden; excludes this region's two boundaries. |
| `hidden`                                         | Parks or restores content while preserving the region's position; repeated assignments do no DOM work.             |
| `insertBefore(parent, before = null)`            | Inserts or moves the complete region into an element, shadow root, or native document fragment; `null` appends.    |
| `remove()`                                       | Detaches the whole region while retaining its nodes and visibility for reuse.                                      |

Native `DocumentFragment` inputs transfer their children into the new region.
Pass an explicit `ownerDocument` for an iframe or another document; insertion into another document follows native adoption.
Construction does not access the global `document` until called without that argument.

## Live regions and ownership

Two empty comment nodes delimit the region, including when its content is empty or hidden.
They appear in `childNodes` and serialized HTML, survive `normalize()`, and do not introduce an element or text content.
While visible, nodes inserted, replaced, or removed between the boundaries become part of the current region rather than a stale construction-time node list.
While hidden, edit the parked content through its existing nodes and keep the gap between the mounted boundaries empty.
Nested fragments can change visibility while their enclosing fragment is hidden or detached.
An enclosing fragment's `nodes` snapshot includes any nested fragments' boundaries.
Renderers can recognize a nested start boundary with `PersistentFragment.fromNode(node)` and call its `remove()` instead of removing each of its nodes separately.
This lookup does not search ancestors: ordinary content, end boundaries, and detached visible storage are not registered.
Hidden storage is registered only while active; restoring content removes that storage's registration.

Retain the instance to reuse its region.
Do not remove, reorder, or replace its boundary comments, including through an ancestor's `textContent`, `innerHTML`, or `replaceChildren()`.
Subsequent structural operations and `nodes` reads throw `InvalidStateError` when the boundaries are damaged.
Changing content outside those boundaries does not add it to the fragment.
The instance does not provide a content reconciliation or append API; prepare empty or nested content in a native `DocumentFragment` before construction when needed.

`hidden` and `remove()` preserve node identity, form values, event listeners, and application subscriptions.
They do not dispose application resources.
Native removal and insertion still run custom-element lifecycle callbacks and can reset focus, selections, animations, or iframe state.
A mutation or `nodes` read of the same instance during its own DOM operation throws `InvalidStateError`; schedule such work after the operation returns.
Extraction moves siblings in order, so callbacks can observe an intermediate tree; defer structural edits to overlapping regions until the operation returns.

Invalid reference nodes and destinations inside the fragment are rejected before extraction.
Containment includes nested hidden regions and shadow roots, preventing cycles through their parked contents.
Other native insertion errors leave the region detached and reusable.

## Cost and validation

The implementation has no runtime dependencies, observers, or subscriptions.
A weak registry tracks each start boundary and active hidden-storage fragment, not every content node.
It transfers siblings directly into native `DocumentFragment`s without cloning nodes or allocating per-move node arrays.
Visibility changes and moves scale with content size; unchanged visibility is constant-time, and requesting `nodes` allocates a snapshot.

`npm test --workspace @serve-tools/client-dom-fragment` runs the contract in Chromium, Firefox, and WebKit.
`npm run benchmark --workspace @serve-tools/client-dom-fragment` measures creation, visibility, moves, and unchanged visibility in Chromium using the repository's warmed-sample reporter.
These measurements cover synchronous JavaScript and DOM operations, not layout or paint.
