import type { AnyRoute } from "@serve-tools/router";
import type { StandardSchemaV1 } from "@standard-schema/spec";

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
	readonly operationId: string;
	readonly summary?: string;
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
	readonly serialization: Serialization;
} & Operations;

/** Any concrete route entry. */
export type AnyRouteEntry = RouteContract;

/** An executable HTTP contract shared by trusted adapters and erased client types. */
export interface API<
	CommonResponses extends ResponseMap = ResponseMap,
	Routes extends Readonly<Record<string, AnyRouteEntry>> = Readonly<Record<string, AnyRouteEntry>>,
> {
	readonly commonResponses?: CommonResponses;
	readonly routes: Routes;
}

/** Any concrete HTTP API contract. */
export type AnyAPI = API;

/** Extracts an API's path-keyed route map. */
export type APIRoutes<Value extends AnyAPI> = Value["routes"];

/** Extracts an API's common response map, or an empty map when none is declared. */
export type APICommonResponses<Value extends AnyAPI> = Value extends {
	readonly commonResponses: infer Responses extends ResponseMap;
}
	? Responses
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
export type OwnOperationResponses<Value extends AnyOperation> = Value["responses"];

/** Merges an operation's response map over its API's common response map. */
export type OperationResponses<Value extends AnyAPI, Selected extends AnyOperation> = Omit<
	APICommonResponses<Value>,
	keyof OwnOperationResponses<Selected>
> &
	OwnOperationResponses<Selected>;

/** Extracts all statuses declared for one operation, including common responses. */
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
> = Status extends keyof OwnOperationResponses<Selected>
	? OwnOperationResponses<Selected>[Status]
	: Status extends keyof APICommonResponses<Value>
		? APICommonResponses<Value>[Status]
		: never;
