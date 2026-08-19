# Signal libraries

A TC39 Signals implementation and signal-aware runtime libraries.
Each package directory is an independently versioned npm workspace.

## Packages

- [`@serve-tools/signal-collections`](./collections/) provides signal-aware Array, Map, Set, and Object collections.
- [`@serve-tools/signal-effect`](./effect/) provides microtask-batched effects.
- [`@serve-tools/signal`](./signal/) implements the Signal namespace and its state, computed, and watcher primitives.
- [`@serve-tools/signals`](./signals/) provides one flat facade and focused subpaths for the compatible Signal packages.
