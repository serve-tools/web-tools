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
- Preserve Navigation API cancellation by passing each loader's signal to its work.
- Let CSS own View Transition motion and reduced-motion preferences.
