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
// { path: "/projects/:id", route, url, params: { id: 42 }, search: { parentId: undefined, tab: "files", tag: [], q: undefined } }
```

## Install

```shell
npm install @serve-tools/router
```

#### Import from a CDN

```js
import * as router from "https://esm.run/@serve-tools/router";
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
Adjacent named parameters such as `:first:second` are also rejected because no separator identifies a unique inverse, while literal-affix routes such as `/assets/:id.:format-:variant` remain supported.
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
Custom default values are formatted once when the codec is declared and parsed again for every omitted match.
This snapshots the codec-defined wire representation without imposing arbitrary cloning rules on custom values.

## Codec metadata

Every codec exposes portable, readonly `metadata` for integrations that inspect `route.options.params` and `route.options.search`.
It reports the codec `type`, `required` and `repeated` shape, any enum `values` or defined `defaultValue`, and whether the codec supports schema-free `native` HTTP-client serialization.

```ts
projectRoute.options.params?.id.metadata;
// { type: "integer", required: true, repeated: false, native: true }
```

String, integer, and enum codecs remain native-compatible through `.optional()`, `.default()`, and `.many()`.
`codec.schema()` and all of its derivatives report `native: false` because a schema may accept values that the generic native serializer cannot reproduce.
Use a route-owned `href()` serialization mode when an integration needs a custom codec.

## Building and matching URLs

`route.href(input)` encodes pathname and search values and throws `TypeError` when required values are missing or invalid.
An empty pathname parameter, a standalone `.` or `..` parameter, and a non-well-formed Unicode pathname value are invalid because they cannot round trip through URL parsing.
After formatting each pathname value, `href()` verifies that matching the generated URL produces the same codec-formatted wire value and throws when a codec or pattern would change it.
Its input is inferred from the declaration: pathname parameters and required search values are required, while optional, defaulted, and repeated search values may be omitted.
Routes without required inputs support `route.href()`.

`route.match(url)` accepts an absolute or relative HTTP(S) URL string or a `URL` object.
It returns `null` when the pathname does not match or a declared value does not decode.
Otherwise it returns the declared `path`, route identity, a normalized `URL`, and typed `params` and `search` objects.
`RouteMatch<A | B>` preserves the route-specific parameter and search types: compare `match.path === projectRoute.path` to narrow them without a helper or cast.
This is the declared path template, not the destination pathname.
Routes sharing the same template retain a union of their codec types; a path check cannot distinguish their identities.

## Portable loading

The optional `loading` object records a `blocking` or `deferred` policy for runtime integrations.
It may also contain a portable `load({ params, search, url, signal })` callback.
This package stores frozen shallow snapshots of `params`, `search`, `loading`, and the complete route options so caller mutations cannot diverge public metadata from matching behavior.
It does not freeze the caller-owned objects or invoke loaders itself.

Use `RouteParams<R>`, `RouteSearch<R>`, `RouteInput<R>`, and `RouteData<R>` to extract inferred types.
`Codec<Value>`, `CodecMetadata<Value>`, `ValueSchema<Value>`, `RouteMatch<R>`, `Route`, `AnyRoute`, `RouteDefinition`, and the loader types support integration authors.

## Migration to 0.2

Every successful match now includes the declared `path`, and `RouteMatch<A | B>` is a distributive union.
Narrow mixed matches with `match.path === selectedRoute.path`; update tests, adapters, or fixtures that construct `RouteMatch` values to include that discriminator.

Every public `Codec` now includes readonly `metadata` used by HTTP and documentation integrations.
Application-defined scalar behavior should continue to use `codec.schema()` rather than constructing a `Codec` object; integration types that expose `Codec` must preserve its metadata.

Route creation now rejects adjacent parameters such as `:first:second`.
`href()` also rejects pathname values that cannot survive URL parsing or reproduce the codec's formatted wire value when matched.
Keep literal-affix parameters such as `:id.:format-:variant`, but replace ambiguous adjacent patterns and treat new `TypeError` failures as invalid route input.

The complete route options object and its `params`, `search`, and `loading` members are now frozen shallow snapshots.
Create a new route instead of mutating an options object after `route()` returns.

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
