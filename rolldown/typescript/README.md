# @serve-tools/rolldown-typescript

`@serve-tools/rolldown-typescript` is a plugin that brings TypeScript compilation and type checking directly into Vite and Rolldown builds.
It passes the compiled code to Vite or Rolldown, keeps debugging tied to your original source, and respects how each package `exports` is meant to be used.

## Installation

```sh
npm install --save-dev @serve-tools/rolldown-typescript
```

It requires TypeScript `~7.1.0-0` (stable 7.1 releases and 7.1.0 prereleases).
Use it with Vite `^8.2.2` or Rolldown `^1.2.7` on Node.js `^22.14.0 || >=24.0.0`.

## Usage

```ts
import { defineConfig } from "vite";
import { typescript } from "@serve-tools/rolldown-typescript";

export default defineConfig({
	plugins: [typescript()],
});
```

## API

`typescript(options?)` returns a Vite/Rolldown-compatible plugin immediately.
Compiler initialization starts in the background; Vite and Rolldown await it before serving or building.
Initialization errors reject host startup and close the compiler automatically.

- `configFile?: string` selects the root project configuration and defaults to `tsconfig.json`.
- `cwd?: string` selects the compiler working directory and defaults to `process.cwd()`.
- `conditions?: readonly string[]` adds package-export conditions.
- `plugin.api.dispose(): Promise<void>` closes the compiler after pending work and may be called repeatedly.

This package includes `skills/serve-tools-rolldown-typescript/SKILL.md` with version-aligned consumer guidance.
