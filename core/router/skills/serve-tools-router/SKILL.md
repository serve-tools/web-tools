---
name: serve-tools-router
description: Use @serve-tools/router for typed universal route declarations.
---

# Use @serve-tools/router

Treat the installed package README and public declarations as the API source of truth.
Read only the reference needed for the current task.

## Route by task

- [Recipe: declare and use a typed route](references/recipe-quick-start.md): compile-checked reusable codecs, params, search values, href generation, and URL matching.
- Reuse one `codec` factory API for required pathname values and optional, defaulted, or repeated search values.
- Narrow mixed route matches with `match.path === selectedRoute.path`; the declared path discriminates parameter and search types without comparing route objects or casting.
- Inspect readonly `codec.metadata` through `route.options` when an integration needs portable type, requiredness, repetition, default, enum, or native-serialization facts.
- When migrating from 0.1, add `path` to constructed match fixtures, preserve metadata in `Codec`-typed integrations, replace adjacent parameters, and create a new route instead of mutating snapshotted options.
- To preserve matching and loading semantics, read [Preserve route contracts](references/preserve-route-contracts.md).
