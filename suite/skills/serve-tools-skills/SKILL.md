---
name: serve-tools-skills
description: Use @serve-tools/skills to choose focused Serve Tools packages.
---

# Serve Tools package guide

Choose packages by required capability and runtime ownership.
Prefer a focused package over `@serve-tools/client` or `@serve-tools/signals`.
Use a facade only when access to several related packages is intentional.

## Route the task

- Read [Package selection](references/package-selection.md) to map a problem to the smallest package.
- Read [Common combinations](references/common-combinations.md) when a task crosses reactive, worker, Lit, or build-time boundaries.

After selecting packages, load each package's bundled Skill for API contracts and compile-checked recipes.
Do not infer that similarly named base and signal-aware packages are interchangeable.
