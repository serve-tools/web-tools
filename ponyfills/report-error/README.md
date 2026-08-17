# @serve-tools/ponyfill-report-error

The `@serve-tools/ponyfill-report-error` package provides a console-backed `reportError()` implementation without reading, installing, or replacing a global.

```ts
import { reportError } from "@serve-tools/ponyfill-report-error";

reportError(new Error("Background task failed"));
```

## Install

```shell
npm install @serve-tools/ponyfill-report-error
```

This is the fallback implementation rather than the native-aware selection layer.
Use [`@serve-tools/polyfill-report-error`](../../polyfills/report-error/) when an imported function should preserve the native platform implementation where available, or its `./apply` subpath when a missing global should be installed.

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
