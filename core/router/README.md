# @serve-tools/router

`@serve-tools/router` declares unnamed, strongly typed routes that browser and server integrations can share.

```ts
import { codec, route } from "@serve-tools/router";

const id = codec.integer();

const projectRoute = route("/projects/:id", {
	params: {
		id,
	},
	search: {
		parentId: id.optional(),
		tab: codec.enum("overview", "files").default("overview"),
		tag: codec.string().many(),
		q: codec.string().optional(),
	},
	loading: {
		mode: "blocking",
	},
});

projectRoute.href({ params: { id: 42 }, search: { tag: ["active"] } });
// "/projects/42?tag=active"

projectRoute.match("https://example.com/projects/42?tab=files");
// { route, url, params: { id: 42 }, search: { parentId: undefined, tab: "files", tag: [], q: undefined } }
```

## Install

```shell
npm install @serve-tools/router
```

## Platform requirement

The runtime must provide `globalThis.URLPattern`.
For an environment without native support, install and import `@serve-tools/polyfill-urlpattern` explicitly before creating routes.
Keeping that choice in the application prevents compatibility code from entering modern browser bundles.

```ts
import "@serve-tools/polyfill-urlpattern";
import { route } from "@serve-tools/router";

const home = route("/");
```

## Route declarations

Call `route(path, options)` with a pathname beginning in `/`.
Pathnames support literal text and required named parameters such as `:id`.
Regular-expression groups, optional or repeated parameters, wildcards, and URLPattern escape syntax are intentionally excluded so every declared path can be reversed by `href()`.
Search and hash syntax belongs outside the pathname declaration.

The optional `params` object changes selected pathname parameters from their default `string` representation.
The same `codec` factories work in both `params` and `search`, so one codec can describe a required pathname value and an optional search value.
Pathname parameters accept required, single-value codecs only.

The optional `search` object declares URL search parameters:

- `codec.string()` decodes one required string.
- `codec.integer()` decodes one required canonical safe integer.
- `codec.enum(...values)` decodes one member of a closed string union.
- `codec.schema(schema)` supplies a portable custom scalar parser and formatter.
- `.optional()` makes a value optional and decodes an omitted key as `undefined`.
- `.default(value)` makes a value optional and decodes an omitted key as the given value.
- `.many()` decodes repeated values in order and defaults to an empty array.

Unknown search keys do not prevent a URL from matching and are not included in the typed result.
Repeated instances of a scalar search key do prevent a match because they would otherwise be ambiguous.

## Building and matching URLs

`route.href(input)` encodes pathname and search values and throws `TypeError` when required values are missing or invalid.
Its input is inferred from the declaration: pathname parameters and required search values are required, while optional, defaulted, and repeated search values may be omitted.
Routes without required inputs support `route.href()`.

`route.match(url)` accepts an absolute or relative HTTP(S) URL string or a `URL` object.
It returns `null` when the pathname does not match or a declared value does not decode.
Otherwise it returns the route, a normalized `URL`, and typed `params` and `search` objects.

## Portable loading

The optional `loading` object records a `blocking` or `deferred` policy for runtime integrations.
It may also contain a portable `load({ params, search, url, signal })` callback.
This package stores the policy and callback but does not invoke them itself.

Use `RouteParams<R>`, `RouteSearch<R>`, `RouteInput<R>`, and `RouteData<R>` to extract inferred types.
`Codec<Value>`, `ValueSchema<Value>`, `RouteMatch<R>`, `Route`, `AnyRoute`, `RouteDefinition`, and the loader types support integration authors.

## Agent Skill

This package includes `skills/serve-tools-router/SKILL.md` with version-aligned usage guidance for compatible coding agents.
Activation is explicit; installing the package does not automatically trust or enable it.

## Development

```shell
npm run typecheck --workspace @serve-tools/router
npm test --workspace @serve-tools/router
npm run build --workspace @serve-tools/router
npm run check:package --workspace @serve-tools/router
```

## License

[MIT-0](./LICENSE.md)
