# @serve-tools/ponyfill-urlpattern

The `@serve-tools/ponyfill-urlpattern` package implements the standard `URLPattern` API without installing or replacing a global.
Use it to match URLs, capture named pathname groups, and inspect individual URL components consistently across browsers and server runtimes.

```ts
import { URLPattern } from "@serve-tools/ponyfill-urlpattern";

const pattern = new URLPattern({ pathname: "/books/:id" });
const match = pattern.exec("https://example.com/books/123");

console.log(match?.pathname.groups.id); // "123"
```

## Install

```shell
npm install @serve-tools/ponyfill-urlpattern
```

## Match URL components

Provide an object to match individual components, or provide an absolute URL pattern string.
Named groups, wildcard groups, and custom regular expressions are available in matching components.

```ts
import { URLPattern } from "@serve-tools/ponyfill-urlpattern";

const pattern = new URLPattern({
	hostname: "*.example.com",
	pathname: "/users/:userId/posts/:postId",
});

pattern.test("https://app.example.com/users/42/posts/7"); // true

const match = pattern.exec("https://app.example.com/users/42/posts/7");

console.log(match?.pathname.groups.userId); // "42"
console.log(match?.pathname.groups.postId); // "7"
```

Relative pattern strings accept a separate base URL, and the `ignoreCase` option enables case-insensitive matching.

```ts
const pattern = new URLPattern("/Books/:id", "https://example.com", { ignoreCase: true });

pattern.test("https://example.com/books/123"); // true
```

## Public API

- `URLPattern`: constructs a URL pattern and exposes `test`, `exec`, component strings, and `hasRegExpGroups`.
- `URLPatternInput`: a URL string or `URLPatternInit` object.
- `URLPatternInit`: optional `protocol`, `username`, `password`, `hostname`, `port`, `pathname`, `search`, `hash`, and `baseURL` components.
- `URLPatternOptions`: optional case-insensitive matching through `ignoreCase`.
- `URLPatternResult`: the original inputs and the match result for each URL component.
- `URLPatternComponentResult`: the matched component input and its named or numbered groups.

## Ponyfill boundary

The exported constructor always uses this package's implementation, even when a runtime provides a native `URLPattern`.
Importing this package does not install, replace, or otherwise mutate `globalThis.URLPattern`.
Use `@serve-tools/polyfill-urlpattern` when an application intentionally needs a global installation that preserves existing native implementations.

## Compatibility

The implementation is dependency-free and uses standard `URL`, well-formed Unicode strings, and regular-expression Unicode sets.
The package preserves the upstream behavior and Web Platform Test conformance fixtures across Node.js, Chromium, Firefox, and WebKit.

## Agent Skill

This package includes `skills/serve-tools-ponyfill-urlpattern/SKILL.md` with version-aligned usage guidance for compatible coding agents.
Activation is explicit; installing the package does not automatically trust or enable it.

## Development

```shell
npm run typecheck --workspace @serve-tools/ponyfill-urlpattern
npm run test:node --workspace @serve-tools/ponyfill-urlpattern
npm run test:browser --workspace @serve-tools/ponyfill-urlpattern
npm run build --workspace @serve-tools/ponyfill-urlpattern
```

## License

[MIT-0](./LICENSE.md)
