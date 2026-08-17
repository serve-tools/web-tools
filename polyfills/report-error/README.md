# @serve-tools/polyfill-report-error

The `@serve-tools/polyfill-report-error` package exports the native web-platform `reportError()` function when available and the console-backed [`@serve-tools/ponyfill-report-error`](../../ponyfills/report-error/) implementation otherwise.
The default import does not modify the global environment.

```ts
import { reportError } from "@serve-tools/polyfill-report-error";

reportError(new Error("Background task failed"));
```

## Install

```shell
npm install @serve-tools/polyfill-report-error
```

Browsers, workers, Bun, and Deno retain native error-reporting behavior.
Runtimes without the web API, notably Node.js, use the ponyfill.

## Apply globally

Import the `./apply` subpath for its side effect when code expects `globalThis.reportError` to exist:

```ts
import "@serve-tools/polyfill-report-error/apply";
```

The apply entrypoint preserves an existing native function and installs the ponyfill only when the global is missing.

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
