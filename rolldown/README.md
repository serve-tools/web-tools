# Rolldown plugins

Plugins that extend Rolldown with web platform tooling.
Each immediate subdirectory is an independently versioned npm workspace.

Use [Decorators](./decorators/) to write standard decorator source and bundle its runtime support.
Use [TypeScript](./typescript/) to compile and type-check a referenced TypeScript project through the build host.
Both work with Vite as well as Rolldown, but they solve different jobs: decorator lowering and project compilation.

## Plugins

- [`@serve-tools/rolldown-decorators`](./decorators/) transforms modern TC39 decorator syntax for Rolldown and Vite.
- [`@serve-tools/rolldown-typescript`](./typescript/) experimentally compiles referenced TypeScript projects in memory for Rolldown and Vite.
