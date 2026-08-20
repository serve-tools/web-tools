# Preserve the ponyfill boundary

- Import values from the package root.
- Do not install or replace globals.
- Do not substitute native scheduler or task-control globals automatically.
- Keep tasks that share a TaskController on this package's scheduler when dynamic reprioritization matters.
- Use `@serve-tools/polyfill-prioritized-task-scheduling` when native identity or global installation is required.
