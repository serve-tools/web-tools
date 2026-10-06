# Vite plugins

Plugins that extend Vite with web platform tooling.
Each immediate subdirectory is an independently versioned npm workspace.

Use [Polyfills](./polyfills/) when application code should use platform APIs directly and the build should inject the missing runtime support.
For decorator lowering or TypeScript project compilation, see the [cross-compatible Rolldown plugins](../rolldown/).

## Plugins

- [`@serve-tools/vite-polyfills`](./polyfills/) detects and injects polyfills for unsupported JavaScript features in Vite projects.
