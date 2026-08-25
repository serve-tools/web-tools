import type {
	AnyRoute,
	Codec,
	Route,
	RouteData,
	RouteInput,
	RouteMatch,
	RouteParams,
	RouteSearch,
} from "../src/router.js";
import { codec, route } from "../src/router.js";

type Equal<Left, Right> =
	(<Value>() => Value extends Left ? 1 : 2) extends <Value>() => Value extends Right ? 1 : 2 ? true : false;
type Expect<Value extends true> = Value;

const id = codec.integer();
const project = route("/projects/:id/:slug", {
	params: { id },
	search: {
		tab: codec.enum("overview", "files").default("overview"),
		tag: codec.string().many(),
		q: codec.string().optional(),
		page: codec.integer(),
		parentId: id.optional(),
	},
	loading: {
		mode: "blocking",
		load: async ({ params, search }) => ({ id: params.id, page: search.page }),
	},
});

const home = route("/");
const affixed = route("/assets/:id.:format-:variant");
const identifiers = route("/values/:$first/:_second/:third9/:CAPITAL");
const kind = codec.enum("new", "popular");
const browse = route("/browse/:kind", {
	params: { kind },
	search: { related: kind.optional() },
});
const repeated = route("/repeated", {
	search: {
		tags: codec.string().many(),
		optionalTags: codec.string().many().optional(),
		defaults: codec.integer().many().default([1, 2]),
	},
});
const uppercase = codec.schema({
	parse: (value: string) => value.toUpperCase() as Uppercase<string>,
	format: (value: Uppercase<string>) => value,
});
const custom = route("/custom/:value", {
	params: { value: uppercase },
	search: { related: uppercase.optional() },
});
const anyRoute: AnyRoute = project;
const scalarCodec: Codec<number> = id;
const match: RouteMatch<typeof project> | null = project.match("/projects/1/readme?page=2");

project.href({ params: { id: 1, slug: "readme" }, search: { page: 2 } });
project.href({
	params: { id: 1, slug: "readme" },
	search: { page: 2, q: "find", tab: "files", tag: ["typed", "routes"] },
});
home.href();
home.href({});
affixed.href({ params: { id: "logo", format: "svg", variant: "dark" } });
identifiers.href({ params: { $first: "one", _second: "two", third9: "three", CAPITAL: "four" } });
browse.href({ params: { kind: "new" }, search: { related: "popular" } });
repeated.href();
repeated.href({ search: { tags: ["one"], optionalTags: ["two"], defaults: [3] } });
custom.href({ params: { value: "VALUE" }, search: { related: "RELATED" } });

export type PublicInference = [
	Route,
	Expect<Equal<RouteParams<typeof project>, { id: number; slug: string }>>,
	Expect<
		Equal<
			RouteSearch<typeof project>,
			{
				tab: "overview" | "files";
				tag: string[];
				q: string | undefined;
				page: number;
				parentId: number | undefined;
			}
		>
	>,
	Expect<
		Equal<RouteParams<typeof identifiers>, { $first: string; _second: string; third9: string; CAPITAL: string }>
	>,
	Expect<Equal<RouteParams<typeof browse>, { kind: "new" | "popular" }>>,
	Expect<Equal<RouteSearch<typeof browse>, { related: "new" | "popular" | undefined }>>,
	Expect<
		Equal<RouteSearch<typeof repeated>, { tags: string[]; optionalTags: string[] | undefined; defaults: number[] }>
	>,
	Expect<Equal<RouteParams<typeof custom>, { value: Uppercase<string> }>>,
	Expect<Equal<RouteSearch<typeof custom>, { related: Uppercase<string> | undefined }>>,
	Expect<Equal<RouteData<typeof project>, { id: number; page: number }>>,
	RouteInput<typeof project>,
];

// @ts-expect-error id uses its declared integer codec
project.href({ params: { id: "1", slug: "readme" }, search: { page: 2 } });
// @ts-expect-error page is a required search value
project.href({ params: { id: 1, slug: "readme" } });
// @ts-expect-error enum values form a closed string union
project.href({ params: { id: 1, slug: "readme" }, search: { page: 2, tab: "unknown" } });
// @ts-expect-error parameter schemas may only name parameters present in the path
route("/projects/:id", { params: { other: codec.integer() } });
// @ts-expect-error pathname parameters cannot use an optional codec
route("/projects/:id", { params: { id: codec.integer().optional() } });
// @ts-expect-error pathname parameters cannot use a defaulted codec
route("/projects/:id", { params: { id: codec.integer().default(1) } });
// @ts-expect-error pathname parameters cannot use a repeated codec
route("/projects/:id", { params: { id: codec.integer().many() } });
// @ts-expect-error repeated conversion requires an unmodified scalar codec
codec.string().optional().many();
// @ts-expect-error repeated conversion cannot follow a default
codec.string().default("value").many();
// @ts-expect-error repeated codecs cannot be made repeated again
codec.string().many().many();
// @ts-expect-error enumerated pathname values form a closed string union
browse.href({ params: { kind: "unknown" } });
// @ts-expect-error repeated search values must be arrays
repeated.href({ search: { tags: "one" } });
// @ts-expect-error repeated defaults must preserve the scalar value type
codec.integer().many().default(["one"]);

void anyRoute;
void scalarCodec;
void match;
