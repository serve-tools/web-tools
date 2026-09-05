# Configure a host

Install a TypeScript version supported by `~7.1.0-0` with `@serve-tools/rolldown-typescript` and either Vite or Rolldown.
The compiler range `~7.1.0-0` also accepts 7.1.0 prereleases; current executable validation uses `7.1.0-dev.20260904.1`.
The tested host versions are Vite `8.2.2` and Rolldown `1.2.7`.

Put `typescript()` directly in the host's `plugins` array; the factory is synchronous.
The plugin starts compiler initialization immediately and the host awaits it before serving or building.
Initialization errors reject host startup and close the compiler automatically.
Vite closes the plugin with its server or build lifecycle.

For direct Rolldown use, create one plugin for one invocation, pass it in `plugins`, and close the bundle in `finally`.
Also await `plugin.api.dispose()` in `finally`; it is idempotent and handles setup failures before the host owns the plugin.

Build configuration-time dependencies and generate needed assets before loading the Vite or Rolldown configuration.
The plugin cannot compile code required to load the configuration that creates it.
