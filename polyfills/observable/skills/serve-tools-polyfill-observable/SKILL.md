---
name: serve-tools-polyfill-observable
description: Install @serve-tools/polyfill-observable globals.
---

# Use @serve-tools/polyfill-observable

Treat the installed package README and public declarations as the API source of truth.
The bundled `0.0.x` fallback is an intentional cold subset whose semantics can differ from a selected native Observable; do not claim complete proposal fidelity.
Read only the reference needed for the current task.

## Route by task

- [Recipe: quick start](references/recipe-quick-start.md): compile-checked global installation and native-aware construction.
- To choose between complete installation, selective installation, and mutation-free selection, read [Choose the import boundary](references/choose-the-import-boundary.md).
- For fallback execution and cancellation boundaries, read [Preserve independent executions](references/preserve-independent-executions.md).
