---
name: serve-tools-ponyfill-observable
description: Use @serve-tools/ponyfill-observable for cold Web Observable executions.
---

# Use @serve-tools/ponyfill-observable

Treat the package README and public declarations as the supported API subset.
This initial `0.0.x` package deliberately differs from the current WICG draft and must not be presented as a conforming polyfill or transparent native fallback.

- For event consumption and custom producers, use the [compile-checked recipe](references/recipe-quick-start.md).
- For native compatibility, cancellation, and producer resource ownership, read [Preserve independent executions](references/preserve-independent-executions.md).
