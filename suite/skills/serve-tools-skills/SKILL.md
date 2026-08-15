---
name: serve-tools-skills
description: Use @serve-tools/skills to choose the smallest package or package combination for browser state, messaging, signals, Lit, polyfills, and Vite. Use when selecting among the suite before loading a package-specific Skill. Do not use as a substitute for the selected package's API recipes.
---

# Serve Tools package guide

Choose packages by required capability and runtime ownership.
Prefer a focused package over `@serve-tools/client`; use the facade only when namespace-oriented access to several client utilities is intentional.

## Route the task

- Read [Package selection](references/package-selection.md) to map a problem to the smallest package.
- Read [Common combinations](references/common-combinations.md) when a task crosses reactive, worker, Lit, or build-time boundaries.

After selecting packages, load each package's bundled Skill for API contracts and compile-checked recipes.
Do not infer that similarly named base and signal-aware packages are interchangeable.
