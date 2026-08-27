import type { AnyRoute, RouteSearch, route } from "@serve-tools/router";
import type { StandardSchemaV1 } from "@standard-schema/spec";
import type { DefaultAdapterResponses } from "./adapter.js";

/** HTTP methods supported by JSON HTTP contracts. */
export const httpMethods = ["DELETE", "GET", "PATCH", "POST", "PUT"] as const;

/** An HTTP method supported by JSON HTTP contracts. */
export type HTTPMethod = (typeof httpMethods)[number];

/** A vendor-neutral Standard Schema validator. */
export type Schema<Input = unknown, Output = Input> = StandardSchemaV1<Input, Output>;

/** A response validator, or the marker for a response that cannot have a body. */
export type ResponseSchema = Schema | null;

/** A numeric HTTP-status-to-response-schema map. */
export type ResponseMap = Readonly<Record<number, ResponseSchema>>;

type NormalizeResponseStatus<Key> = Key extends number
	? Key
	: Key extends `${infer Status extends number}`
		? `${Status}` extends Key
			? Status
			: never
		: never;

/** Extracts numeric statuses from numeric or canonical numeric-string response keys. */
export type ResponseMapStatuses<Responses extends object> = NormalizeResponseStatus<keyof Responses>;

/** Selects a response by its normalized numeric status. */
export type ResponseMapAt<
	Responses extends object,
	Status extends ResponseMapStatuses<Responses>,
> = Status extends keyof Responses
	? Responses[Status]
	: `${Status}` extends keyof Responses
		? Responses[`${Status}`]
		: never;

/** Normalizes a response map to readonly numeric status keys. */
export type NormalizedResponseMap<Responses extends object> = {
	readonly [Status in ResponseMapStatuses<Responses>]: ResponseMapAt<Responses, Status>;
};

/** Extracts the input accepted by a Standard Schema validator. */
export type SchemaInput<Value> = Value extends StandardSchemaV1 ? StandardSchemaV1.InferInput<Value> : never;

/** Extracts the output produced by a Standard Schema validator. */
export type SchemaOutput<Value> = Value extends StandardSchemaV1 ? StandardSchemaV1.InferOutput<Value> : never;

/** Extracts the handler input accepted by a response schema. */
export type ResponseInput<Value extends ResponseSchema> = Value extends Schema ? SchemaInput<Value> : undefined;

/** Extracts the public output produced by a response schema. */
export type ResponseOutput<Value extends ResponseSchema> = Value extends Schema ? SchemaOutput<Value> : undefined;

/** One declared HTTP operation. */
export interface Operation<
	Body extends Schema | undefined = Schema | undefined,
	Responses extends ResponseMap = ResponseMap,
> {
	readonly operationId?: string;
	readonly summary?: string;
	readonly description?: string;
	readonly tags?: readonly string[];
	readonly deprecated?: boolean;
	readonly security?: readonly Readonly<Record<string, readonly string[]>>[];
	readonly body?: Body;
	readonly responses: Responses;
}

/** Any concrete operation declaration. */
export type AnyOperation = Operation;

/** The client-side URL serialization supported by one route entry. */
export type SerializationMode = "href" | "native";

/** A supported-method-to-operation map. */
export type OperationMap = Readonly<Partial<Record<HTTPMethod, AnyOperation>>>;

/** One route and the HTTP operations declared on it. */
export type RouteContract<
	Route extends AnyRoute = AnyRoute,
	Serialization extends SerializationMode = SerializationMode,
	Operations extends OperationMap = OperationMap,
> = {
	readonly route: Route;
} & (Serialization extends "href"
	? { readonly serialization: Serialization }
	: { readonly serialization?: Serialization }) &
	Operations;

/** Any concrete route entry. */
export type AnyRouteEntry = {
	readonly route: AnyRoute;
	readonly serialization?: SerializationMode;
} & OperationMap;

/** A route declaration; an omitted route uses the map key and default string parameters. */
export type RouteDeclaration = {
	readonly route?: AnyRoute;
	readonly serialization?: SerializationMode;
} & OperationMap;

/** Application-authored API input, before inferred routes and adapter responses are materialized. */
export interface APIDefinition {
	/** Response schemas shared by every operation in this API; restricted to 4xx/5xx statuses. */
	readonly responses?: ResponseMap;
	readonly routes: Readonly<Record<string, RouteDeclaration>>;
}

type DeclaredAPIResponses<Definition extends APIDefinition> = Definition extends {
	readonly responses: infer Responses extends ResponseMap;
}
	? NormalizedResponseMap<Responses>
	: Record<never, never>;

type DeclaredRoute<Path extends string, Entry extends RouteDeclaration> = Entry extends {
	readonly route: infer Value extends AnyRoute;
}
	? Value
	: ReturnType<typeof route<Path>>;

type RequiredAdapterStatuses<
	Path extends string,
	Entry extends RouteDeclaration,
	Selected extends Operation,
> = Selected extends { readonly body: Schema }
	? 400 | 413 | 415
	: Path extends `${string}:${string}`
		? 400
		: keyof RouteSearch<DeclaredRoute<Path, Entry>> extends never
			? never
			: 400;

type NormalizedOperation<
	Definition extends APIDefinition,
	Path extends string,
	Entry extends RouteDeclaration,
	Selected extends Operation,
> = Selected extends Operation
	? {
			readonly [Key in keyof Selected]: Key extends "responses"
				? NormalizedResponseMap<Selected["responses"]> &
						Pick<
							DefaultAdapterResponses,
							Exclude<
								RequiredAdapterStatuses<Path, Entry, Selected>,
								ResponseMapStatuses<Selected["responses"]> | keyof DeclaredAPIResponses<Definition>
							>
						>
				: Selected[Key];
		}
	: never;

type NormalizedRoute<
	Definition extends APIDefinition,
	Path extends keyof Definition["routes"] & string,
	Entry extends RouteDeclaration = Definition["routes"][Path],
> = {
	readonly route: DeclaredRoute<Path, Entry>;
	readonly serialization: "serialization" extends keyof Entry
		? Exclude<Entry["serialization"], undefined> | (undefined extends Entry["serialization"] ? "native" : never)
		: "native";
} & Omit<
	{
		readonly [Key in keyof Entry]: Key extends HTTPMethod
			? NormalizedOperation<Definition, Path, Entry, Extract<Entry[Key], Operation>>
			: Entry[Key];
	},
	"route" | "serialization"
>;

/** A normalized contract with inferred routes and applicable adapter responses visible to every consumer. */
export type NormalizedAPI<Definition extends APIDefinition> = API<
	"responses" extends keyof Definition ? Definition["responses"] : undefined,
	{
		readonly [Path in keyof Definition["routes"] & string]: NormalizedRoute<Definition, Path>;
	}
>;

type APIResponseProperty<Responses extends ResponseMap | undefined> = [Responses] extends [undefined]
	? Record<never, never>
	: undefined extends Responses
		? { readonly responses?: Extract<Responses, ResponseMap> }
		: keyof Responses extends never
			? Record<never, never>
			: { readonly responses: Extract<Responses, ResponseMap> };

/** An executable HTTP contract shared by trusted adapters and erased client types. */
export type API<
	Responses extends ResponseMap | undefined = ResponseMap | undefined,
	Routes extends Readonly<Record<string, AnyRouteEntry>> = Readonly<Record<string, AnyRouteEntry>>,
> = APIResponseProperty<Responses> & {
	readonly routes: Routes;
};

/** Any concrete HTTP API contract. */
export type AnyAPI = API;

/** Extracts an API's path-keyed route map. */
export type APIRoutes<Value extends AnyAPI> = Value["routes"];

/** Extracts the responses shared at API scope, or an empty map when none is declared. */
export type APIResponses<Value extends AnyAPI> = "responses" extends keyof Value
	? Exclude<Value["responses"], undefined> extends infer Responses
		? [Responses] extends [never]
			? Record<never, never>
			: Responses extends ResponseMap
				? NormalizedResponseMap<Responses>
				: Record<never, never>
		: never
	: Record<never, never>;

/** Extracts the literal route paths declared by an API. */
export type RoutePaths<Value extends AnyAPI> = keyof APIRoutes<Value> & string;

/** Selects one route entry by its literal path. */
export type RouteAt<Value extends AnyAPI, Path extends RoutePaths<Value>> = APIRoutes<Value>[Path];

/** Selects the route paths that declare one supported method. */
export type PathsForMethod<Value extends AnyAPI, Method extends HTTPMethod> = {
	[Path in RoutePaths<Value>]: Method extends keyof RouteAt<Value, Path>
		? RouteAt<Value, Path>[Method] extends AnyOperation
			? Path
			: never
		: never;
}[RoutePaths<Value>];

/** Selects one operation by method and literal route path. */
export type OperationAt<
	Value extends AnyAPI,
	Method extends HTTPMethod,
	Path extends PathsForMethod<Value, Method>,
> = RouteAt<Value, Path>[Method] extends infer Selected extends AnyOperation ? Selected : never;

/** Extracts an operation's own declared responses. */
export type OwnOperationResponses<Value extends AnyOperation> = NormalizedResponseMap<Value["responses"]>;

/** Merges an operation's response map over the response map shared at API scope. */
export type OperationResponses<Value extends AnyAPI, Selected extends AnyOperation> = Omit<
	APIResponses<Value>,
	keyof OwnOperationResponses<Selected>
> &
	OwnOperationResponses<Selected>;

/** Extracts all statuses declared for one operation, including API-level responses. */
export type ResponseStatuses<Value extends AnyAPI, Selected extends AnyOperation> = keyof OperationResponses<
	Value,
	Selected
> &
	number;

/** Selects the schema associated with one declared operation response status. */
export type ResponseAt<
	Value extends AnyAPI,
	Selected extends AnyOperation,
	Status extends ResponseStatuses<Value, Selected>,
> = OperationResponses<Value, Selected>[Status];

type UnionToIntersection<Value> = (Value extends unknown ? (value: Value) => void : never) extends (
	value: infer Intersection,
) => void
	? Intersection
	: never;

type GlobalResponseMap<GlobalResponses extends ResponseMap | undefined> = GlobalResponses extends ResponseMap
	? NormalizedResponseMap<GlobalResponses>
	: Record<never, never>;

type MaterializedOperationResponses<
	Value extends AnyAPI,
	Selected extends AnyOperation,
	GlobalResponses extends ResponseMap | undefined,
> = Omit<OperationResponses<Value, Selected>, keyof GlobalResponseMap<GlobalResponses>>;

type MaterializedOperation<
	Value extends AnyAPI,
	Selected extends AnyOperation,
	GlobalResponses extends ResponseMap | undefined,
> = Omit<Selected, "responses"> & {
	readonly responses: {
		readonly [Status in keyof MaterializedOperationResponses<
			Value,
			Selected,
			GlobalResponses
		>]: MaterializedOperationResponses<Value, Selected, GlobalResponses>[Status];
	};
};

type MaterializedRoute<
	Value extends AnyAPI,
	Selected extends AnyRouteEntry,
	GlobalResponses extends ResponseMap | undefined,
> = {
	readonly [Key in keyof Selected]: Key extends HTTPMethod
		? Selected[Key] extends AnyOperation
			? MaterializedOperation<Value, Selected[Key], GlobalResponses>
			: Selected[Key]
		: Selected[Key];
};

type MaterializedRoutes<Value extends AnyAPI, GlobalResponses extends ResponseMap | undefined> = {
	readonly [Path in RoutePaths<Value>]: MaterializedRoute<Value, RouteAt<Value, Path>, GlobalResponses>;
};

type MaterializedRoutesOf<Value extends AnyAPI, GlobalResponses extends ResponseMap | undefined> = Value extends AnyAPI
	? MaterializedRoutes<Value, GlobalResponses>
	: never;

type ComposedRoutes<Values extends readonly AnyAPI[], GlobalResponses extends ResponseMap | undefined> =
	UnionToIntersection<MaterializedRoutesOf<Values[number], GlobalResponses>> extends infer Routes extends Readonly<
		Record<string, AnyRouteEntry>
	>
		? { readonly [Path in keyof Routes]: Routes[Path] }
		: never;

/** One ordinary API composed from route-disjoint component APIs with component responses materialized per operation. */
export type ComposedAPI<
	Values extends readonly AnyAPI[],
	GlobalResponses extends ResponseMap | undefined = undefined,
> = API<GlobalResponses, ComposedRoutes<Values, GlobalResponses>>;
