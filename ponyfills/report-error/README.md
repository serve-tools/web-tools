# @serve-tools/ponyfill-report-error

Report a failure from a background task while allowing the current code to continue.
The `@serve-tools/ponyfill-report-error` package provides a console-backed `reportError()` implementation without reading, installing, or replacing a global.

```ts
import { reportError } from "@serve-tools/ponyfill-report-error";

reportError(new Error("Background task failed"));
console.log("Continue handling other tasks");
```

The error is reported and the following log still runs.
This fallback calls `console.error`; it does not dispatch browser error events.

## Install

```shell
npm install @serve-tools/ponyfill-report-error
```

#### Import from a CDN

```js
import * as ponyfillReportError from "https://esm.run/@serve-tools/ponyfill-report-error";
```

This is the fallback implementation rather than the native-aware selection layer.
Use [`@serve-tools/polyfill-report-error`](../../polyfills/report-error/) when a missing global should be installed, or its `./reportError` subpath when an imported function should preserve the native platform implementation without changing globals.

## Agent Skill

This package includes `skills/serve-tools-ponyfill-report-error/SKILL.md` with version-aligned usage guidance for compatible coding agents.
Activation is explicit; installing the package does not automatically trust or enable it.

## Development

```shell
npm run typecheck --workspace @serve-tools/ponyfill-report-error
npm test --workspace @serve-tools/ponyfill-report-error
npm run build --workspace @serve-tools/ponyfill-report-error
npm run check:package --workspace @serve-tools/ponyfill-report-error
```

## License

[MIT-0](./LICENSE.md)
