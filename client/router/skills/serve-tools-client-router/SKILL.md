---
name: serve-tools-client-router
description: Use @serve-tools/client-router for typed native browser navigation.
---

# Use @serve-tools/client-router

Treat the installed package README and public declarations as the API source of truth.

## Route by task

- [Recipe: quick start](references/recipe-quick-start.md): compile-checked reusable codecs, route declaration, startup, loading, and native navigation phases.
- Reuse one `codec` factory API for required pathname values and optional, defaulted, or repeated search values.
- Use the current browser realm's `navigation`, `document`, `URLPattern`, and `reportError` globals.
- Install missing Navigation API or `URLPattern` polyfills globally; never bundle compatibility fallbacks.
- Keep installed route arrays ordered and replace them when application authorization changes.
- Use synchronous `shouldIntercept({ match, event })` to return `false` when switching application scope needs a new document; this is not an authorization gate, and native reloads always retain browser handling.
- Interception checks run before loaders and unmatched fallbacks, receive `match: null` for unmatched destinations, and never gate initial `start()` rendering.
- In mixed route callbacks, narrow with `match.path === selectedRoute.path` to recover the selected route's parameter and search types.
- When migrating from 0.1, expect reloads to bypass the router and apply router 0.2's required match-path discriminator, stricter route validation, codec metadata, and frozen option snapshots.
- Preserve Navigation API cancellation by passing each loader's signal to its work.
- Let CSS own View Transition motion and reduced-motion preferences.
