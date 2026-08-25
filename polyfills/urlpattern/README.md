# @serve-tools/polyfill-urlpattern

The `@serve-tools/polyfill-urlpattern` package installs the standard `URLPattern` constructor when it is missing and preserves an existing native implementation.
Its fallback comes from [`@serve-tools/ponyfill-urlpattern`](../../ponyfills/urlpattern/).

```ts
import "@serve-tools/polyfill-urlpattern";

const pattern = new URLPattern({ pathname: "/books/:id" });

pattern.exec("https://example.com/books/42")?.pathname.groups.id; // "42"
```

## Install

```shell
npm install @serve-tools/polyfill-urlpattern
```

## Usage

Import the package before code that expects `globalThis.URLPattern` to exist.
The installed global is writable, configurable, and non-enumerable, matching the native constructor's property descriptor.
Native implementations are never replaced.

Import the `./URLPattern` subpath to select the native constructor when available or the fallback otherwise without modifying the global environment:

```ts
import { URLPattern } from "@serve-tools/polyfill-urlpattern/URLPattern";

const pattern = new URLPattern("/books/:id", "https://example.com");

pattern.test("https://example.com/books/42"); // true
```

Import `@serve-tools/polyfill-urlpattern/apply/URLPattern` when global installation should use the explicit selective entrypoint.

Use [`@serve-tools/ponyfill-urlpattern`](../../ponyfills/urlpattern/) instead when the fallback implementation or its exported `URLPatternInput`, `URLPatternOptions`, `URLPatternInit`, `URLPatternResult`, and `URLPatternComponentResult` types are needed directly.

## Agent Skill

This package includes `skills/serve-tools-polyfill-urlpattern/SKILL.md` with version-aligned usage guidance for compatible coding agents.
Activation is explicit; installing the package does not automatically trust or enable it.

## Development

```shell
npm run typecheck --workspace @serve-tools/polyfill-urlpattern
npm test --workspace @serve-tools/polyfill-urlpattern
npm run build --workspace @serve-tools/polyfill-urlpattern
npm run check:package --workspace @serve-tools/polyfill-urlpattern
```

## License

[MIT-0](./LICENSE.md)
