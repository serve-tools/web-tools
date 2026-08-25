# @serve-tools/polyfill-report-error

The `@serve-tools/polyfill-report-error` package installs the standard `reportError()` function when it is missing and preserves an existing native implementation.
Its fallback comes from [`@serve-tools/ponyfill-report-error`](../../ponyfills/report-error/).

```ts
import "@serve-tools/polyfill-report-error";

reportError(new Error("Background task failed"));
```

## Install

```shell
npm install @serve-tools/polyfill-report-error
```

## Usage

Import the package before code that expects `globalThis.reportError` to exist.
Browsers, workers, Bun, and Deno retain native error-reporting behavior.
Runtimes without the web API, notably Node.js, install the console-backed ponyfill.

### Install the global selectively

Import the `./apply/reportError` subpath for its side effect to install only the missing global:

```ts
import "@serve-tools/polyfill-report-error/apply/reportError";
```

The installer preserves an existing native function and installs the ponyfill only when the global is nullish.

### Import without global mutation

Import the native-aware fallback through the `./reportError` subpath when library code must not modify globals:

```ts
import { reportError } from "@serve-tools/polyfill-report-error/reportError";

reportError(new Error("Background task failed"));
```

The named export preserves the native function's identity when it exists and otherwise uses the console-backed ponyfill.

## Agent Skill

This package includes `skills/serve-tools-polyfill-report-error/SKILL.md` with version-aligned usage guidance for compatible coding agents.
Activation is explicit; installing the package does not automatically trust or enable it.

## Development

```shell
npm run typecheck --workspace @serve-tools/polyfill-report-error
npm test --workspace @serve-tools/polyfill-report-error
npm run build --workspace @serve-tools/polyfill-report-error
npm run check:package --workspace @serve-tools/polyfill-report-error
```

## License

[MIT-0](./LICENSE.md)
