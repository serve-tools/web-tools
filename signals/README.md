# Signal libraries

A TC39 Signals implementation and signal-aware libraries for collections, messaging, browser storage, IndexedDB, and the DOM.
Each package directory is an independently versioned npm workspace.

## Packages

- [`@serve-tools/signal`](./signal/) implements the Signal namespace and its state, computed, and watcher primitives.
- [`@serve-tools/signal-effect`](./effect/) provides microtask-batched effects.
- [`@serve-tools/signal-collections`](./collections/) provides signal-aware Array, Map, Set, and Object collections.
- [`@serve-tools/signal-messaging`](../client-signals/messaging/) observes typed messaging subscriptions as explicit Signal state.
- [`@serve-tools/signal-shared-db`](../client-signals/shared-db/) adds reactive queries to `@serve-tools/client-shared-db`.
- [`@serve-tools/signal-storage`](../client-signals/storage/) adds reactive watches to `@serve-tools/client-storage`.
- [`@serve-tools/signal-dom`](../client-signals/dom/) provides functional signal-aware DOM, SVG, and MathML templating.
