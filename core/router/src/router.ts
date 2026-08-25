const INVALID = Symbol("invalid route value");
const ROUTE_BASE_URL = "https://route.invalid/";
const PATH_PARAMETER_PATTERN = /:([A-Za-z_$][\w$]*)/g;
// biome-ignore lint/suspicious/noControlCharactersInRegex: Route paths intentionally reject control characters.
const VALID_PATH_PATTERN = /^\/(?!\/)(?:[^:%\\?#{()*\x00-\x1f\x7f]|:[A-Za-z_$][\w$]*)*$/;

type Invalid = typeof INVALID;
type EmptyDefinition = Record<never, never>;
type LowercaseLetter =
	| "a"
	| "b"
	| "c"
	| "d"
	| "e"
	| "f"
	| "g"
	| "h"
	| "i"
	| "j"
	| "k"
	| "l"
	| "m"
	| "n"
	| "o"
	| "p"
	| "q"
	| "r"
	| "s"
	| "t"
	| "u"
	| "v"
	| "w"
	| "x"
	| "y"
	| "z";

type PathParameterCharacter =
	| "$"
	| "_"
	| LowercaseLetter
	| Uppercase<LowercaseLetter>
	| `${0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9}`;

type TakePathParameter<Value extends string, Name extends string = ""> = Value extends `${infer Character}${infer Rest}`
	? Character extends PathParameterCharacter
		? TakePathParameter<Rest, `${Name}${Character}`>
		: Name
	: Name;

type PathParameterName<Path extends string> = Path extends `${string}:${infer Rest}`
	? TakePathParameter<Rest> | PathParameterName<Rest>
	: never;

type CodecValue<Value> = Value extends { readonly value?: infer Output } ? Output : never;
type CodecInput<Value> = Value extends { readonly input?: infer Input } ? Input : never;
type RequiredQueryKey<Definition extends QueryDefinition> = {
	[Key in keyof Definition]-?: Definition[Key] extends { readonly required?: true } ? Key : never;
}[keyof Definition];

type ParameterValues<Path extends string, Definition extends ParameterDefinition<Path>> = {
	[Name in PathParameterName<Path>]: Name extends keyof Definition ? CodecValue<Definition[Name]> : string;
};

type SearchValues<Definition extends QueryDefinition> = {
	-readonly [Name in keyof Definition]: CodecValue<Definition[Name]>;
};

type SearchInput<Definition extends QueryDefinition, Required extends keyof Definition> = {
	-readonly [Name in Required]: CodecInput<Definition[Name]>;
} & {
	-readonly [Name in Exclude<keyof Definition, Required>]?: CodecInput<Definition[Name]>;
};

type InputSection<Name extends string, Value, Required extends boolean> = Required extends true
	? { [Key in Name]: Value }
	: { [Key in Name]?: Value };

type RouteInputValue<
	Path extends string,
	Parameters extends ParameterDefinition<Path>,
	Search extends QueryDefinition,
	Required extends keyof Search = RequiredQueryKey<Search>,
> = InputSection<"params", ParameterValues<Path, Parameters>, PathParameterName<Path> extends never ? false : true> &
	InputSection<"search", SearchInput<Search, Required>, [Required] extends [never] ? false : true>;

type RequiredInputKey<Input> = {
	[Key in keyof Input]-?: EmptyDefinition extends Pick<Input, Key> ? never : Key;
}[keyof Input];

type RouteHref<Input> = RequiredInputKey<Input> extends never ? (input?: Input) => string : (input: Input) => string;

/** Converts one URL component between its serialized and typed forms. */
export interface ValueSchema<Value> {
	parse(value: string): Value;
	format(value: Value): string;
}

/** A typed URL component codec that can be shared by pathname and search parameters. */
export interface Codec<Output, Input = Output, Required extends boolean = true, Multiple extends boolean = false> {
	readonly value?: Output;
	readonly input?: Input;
	readonly required?: Required;
	readonly multiple?: Multiple;

	/** Returns a codec whose key may be omitted and whose decoded value is then `undefined`. */
	optional(): Codec<Output | undefined, Input | undefined, false, Multiple>;

	/** Returns a codec whose key may be omitted and whose decoded value then uses `value`. */
	default(value: Exclude<Output, undefined>): Codec<Exclude<Output, undefined>, Input | undefined, false, Multiple>;

	/** Returns a search codec that preserves repeated values and defaults to an empty array. */
	many(this: Codec<Output, Output, true, false>): Codec<Output[], Output[] | undefined, false, true>;
}

/** The parameter codecs associated with names present in `Path`. */
export type ParameterDefinition<Path extends string> = Partial<
	Record<PathParameterName<Path>, Codec<unknown, unknown, true, false>>
>;

/** A keyed URL-search schema. */
export type QueryDefinition = Record<string, Codec<unknown, unknown, boolean, boolean>>;

/** The policy controlling when a route's data blocks rendering. */
export type RouteLoadingMode = "blocking" | "deferred";

/** Portable input supplied to a route data loader. */
export interface RouteLoadContext<Params, Search> {
	readonly params: Params;
	readonly search: Search;
	readonly url: URL;
	readonly signal: AbortSignal;
}

/** A portable route data loader. */
export type RouteLoad<Params, Search, Data> = (context: RouteLoadContext<Params, Search>) => Data | PromiseLike<Data>;

/** Route data-loading policy and optional loader. */
export interface RouteLoading<Params, Search, Data = undefined> {
	readonly mode: RouteLoadingMode;
	readonly load?: RouteLoad<Params, Search, Data>;
}

/** Declarative route configuration shared by browser and server integrations. */
export interface RouteDefinition<
	Path extends string,
	Parameters extends ParameterDefinition<Path> = EmptyDefinition,
	Search extends QueryDefinition = EmptyDefinition,
	Data = undefined,
> {
	readonly params?: Parameters;
	readonly search?: Search;
	readonly loading?: RouteLoading<ParameterValues<Path, Parameters>, SearchValues<Search>, Data>;
}

/** One unnamed, strongly typed route declaration. */
export interface Route<
	Path extends string = string,
	Params = unknown,
	Search = unknown,
	Input = never,
	Data = unknown,
	Definition extends RouteDefinition<any, any, any, any> = RouteDefinition<any, any, any, any>,
> {
	readonly path: Path;
	readonly options: Definition;
	readonly href: RouteHref<Input>;
	match(url: string | URL): RouteMatch<Route<Path, Params, Search, Input, Data, Definition>> | null;
}

/** Any concrete route declaration. */
export type AnyRoute = Route<any, any, any, any, any, any>;

/** Extracts the typed pathname parameters of a route. */
export type RouteParams<Value extends AnyRoute> =
	Value extends Route<any, infer Params, any, any, any, any> ? Params : never;

/** Extracts the typed URL-search values of a route. */
export type RouteSearch<Value extends AnyRoute> =
	Value extends Route<any, any, infer Search, any, any, any> ? Search : never;

/** Extracts the typed input accepted by a route's `href` function. */
export type RouteInput<Value extends AnyRoute> =
	Value extends Route<any, any, any, infer Input, any, any> ? Input : never;

/** Extracts the fulfilled result of a route's optional loader. */
export type RouteData<Value extends AnyRoute> =
	Value extends Route<any, any, any, any, infer Data, any> ? Awaited<Data> : never;

/** A URL matched and decoded by one route declaration. */
export interface RouteMatch<Value extends AnyRoute = AnyRoute> {
	readonly route: Value;
	readonly url: URL;
	readonly params: RouteParams<Value>;
	readonly search: RouteSearch<Value>;
}

type RuntimeCodec = readonly [ValueSchema<unknown>, multiple: boolean, missing: unknown, brand: Invalid];

const integerSchema: ValueSchema<number> = {
	parse(value) {
		if (!/^-?(?:0|[1-9]\d*)$/.test(value)) {
			return INVALID as never;
		}

		const number = Number(value);

		return Number.isSafeInteger(number) ? number : (INVALID as never);
	},
	format(value) {
		if (!Number.isSafeInteger(value)) {
			invalid();
		}

		return String(value);
	},
};

const stringSchema: ValueSchema<string> = {
	parse: (value) => value,
	format(value) {
		if (typeof value !== "string") {
			invalid();
		}

		return value;
	},
};

/** Built-in scalar codecs shared by pathname and search parameters. */
export const codec = {
	string: (): Codec<string> => createCodec(stringSchema),
	integer: (): Codec<number> => createCodec(integerSchema),
	enum: <const Values extends readonly [string, ...string[]]>(...values: Values): Codec<Values[number]> => {
		const allowed = new Set<string>(values);

		if (allowed.size !== values.length) {
			invalid();
		}

		return createCodec({
			parse: (value) => (allowed.has(value) ? (value as Values[number]) : (INVALID as never)),
			format: (value) => {
				if (!allowed.has(value)) {
					invalid();
				}

				return value;
			},
		});
	},
	schema: <Value>(schema: ValueSchema<Value>): Codec<Value> => createCodec(schema),
};

/** Declares one unnamed, typed route shared by browser and server integrations. */
export function route<
	const Path extends string,
	const Parameters extends ParameterDefinition<Path> = EmptyDefinition,
	const Search extends QueryDefinition = EmptyDefinition,
	Data = undefined,
>(
	path: Path,
	options: RouteDefinition<Path, Parameters, Search, Data> & {
		readonly params?: Parameters & Record<Exclude<keyof Parameters, PathParameterName<Path>>, never>;
	} = {},
): Route<
	Path,
	ParameterValues<Path, Parameters>,
	SearchValues<Search>,
	RouteInputValue<Path, Parameters, Search>,
	Awaited<Data>,
	RouteDefinition<Path, Parameters, Search, Data>
> {
	const parameterNames = [...path.matchAll(PATH_PARAMETER_PATTERN)].map((match) => match[1]!);

	if (!VALID_PATH_PATTERN.test(path) || new Set(parameterNames).size !== parameterNames.length) {
		invalid();
	}

	const patternInput: URLPatternInit = { pathname: path };
	const pattern = new URLPattern(patternInput);
	const staticPathname = parameterNames.length === 0 && pattern.pathname;
	const parameterCodecs = codecMap(options.params, parameterNames);
	const queryCodecs = codecMap(options.search);

	const concrete = {
		path,
		options,
		href(input?: RouteInputValue<Path, Parameters, Search>) {
			const value = inputObject(input, ["params", "search"]);
			const params = inputObject(value.params, parameterNames);
			const pathname =
				staticPathname ||
				new URL(
					path.replace(PATH_PARAMETER_PATTERN, (_token, name: string) => {
						if (!Object.hasOwn(params, name)) {
							invalid();
						}

						const codec = parameterCodecs.get(name);
						const parameter = params[name];

						if (codec === undefined && typeof parameter !== "string") {
							invalid();
						}

						return encodeURIComponent(
							codec === undefined ? (parameter as string) : codec[0].format(parameter),
						);
					}),
					ROUTE_BASE_URL,
				).pathname;

			const search = inputObject(value.search, [...queryCodecs.keys()]);
			const searchParams = new URLSearchParams();

			for (const [name, codec] of queryCodecs) {
				const searchValue = search[name];

				if (searchValue === undefined) {
					if (codec[2] === INVALID) {
						invalid();
					}

					continue;
				}

				if (!codec[1]) {
					searchParams.set(name, codec[0].format(searchValue));

					continue;
				}

				if (!Array.isArray(searchValue)) {
					invalid();
				}

				for (const item of searchValue) {
					searchParams.append(name, codec[0].format(item));
				}
			}

			return searchParams.size === 0 ? pathname : `${pathname}?${searchParams}`;
		},
		match(input: string | URL) {
			let url: URL;

			try {
				url = new URL(input, ROUTE_BASE_URL);
			} catch {
				return null;
			}

			if (!/^https?:$/.test(url.protocol)) {
				return null;
			}

			patternInput.pathname = url.pathname;

			const groups = staticPathname
				? patternInput.pathname === staticPathname && {}
				: pattern.exec(patternInput)?.pathname.groups;

			if (!groups) {
				return null;
			}

			const params = [];

			for (const name of parameterNames) {
				const value = groups[name]!;
				const parameter = parse(parameterCodecs.get(name)?.[0], value, value.includes("%"));

				if (parameter === INVALID) {
					return null;
				}

				params.push([name, parameter]);
			}

			const search = [];
			const hasSearch = url.search !== "";

			for (const [name, codec] of queryCodecs) {
				const values = hasSearch ? url.searchParams.getAll(name) : undefined;

				let value = Array.isArray(codec[2]) ? [...codec[2]] : codec[2];

				if (values?.length) {
					if (!codec[1] && values.length !== 1) {
						return null;
					}

					const decoded = values.map((value) => parse(codec[0], value));

					if (decoded.includes(INVALID)) {
						return null;
					}

					value = codec[1] ? decoded : decoded[0];
				}

				if (value === INVALID) {
					return null;
				}

				search.push([name, value]);
			}

			return { route: concrete, url, params: Object.fromEntries(params), search: Object.fromEntries(search) };
		},
	};

	return concrete as never;
}

function createCodec<Value>(schema: ValueSchema<Value>, multiple = false, ...missing: [] | [unknown]): Codec<Value> {
	return Object.assign([schema, multiple, missing.length ? missing[0] : INVALID, INVALID] as const, {
		optional: () => createCodec(schema, multiple, undefined),
		default: (value: Value) => {
			const values = multiple ? value : [value];

			if (!Array.isArray(values)) {
				invalid();
			}

			for (const item of values) {
				if (parse(schema, schema.format(item)) === INVALID) {
					invalid();
				}
			}

			return createCodec(schema, multiple, Array.isArray(value) ? Object.freeze([...value]) : value);
		},
		many: () => {
			if (multiple || missing.length) {
				invalid();
			}

			return createCodec(schema, true, []);
		},
	}) as never;
}

function parse(schema: ValueSchema<unknown> | undefined, value: string, encoded = false): unknown | Invalid {
	try {
		if (encoded) {
			value = decodeURIComponent(value);
		}

		return schema ? schema.parse(value) : value;
	} catch {
		return INVALID;
	}
}

function codecMap(value: object | undefined, parameterNames?: readonly string[]): Map<string, RuntimeCodec> {
	return new Map(
		Object.entries(value ?? {}).map(([name, value]) => {
			if (
				!Array.isArray(value) ||
				value[3] !== INVALID ||
				(parameterNames && (value[1] || value[2] !== INVALID || !parameterNames.includes(name)))
			) {
				invalid();
			}

			return [name, value as unknown as RuntimeCodec];
		}),
	);
}

function inputObject(value: unknown, keys: readonly string[]): Record<string, unknown> {
	if (value === undefined) {
		return {};
	}

	if (typeof value !== "object" || value === null || Array.isArray(value)) {
		invalid();
	}

	const prototype = Object.getPrototypeOf(value);

	if (
		(prototype !== Object.prototype && prototype !== null) ||
		Object.keys(value).some((key) => !keys.includes(key))
	) {
		invalid();
	}

	return value as Record<string, unknown>;
}

function invalid(): never {
	throw new TypeError("Invalid route value");
}
