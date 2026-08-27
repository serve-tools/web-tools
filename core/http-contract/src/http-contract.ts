import type { AnyRoute } from "@serve-tools/router";
import { route } from "@serve-tools/router";
import type { StandardSchemaV1 } from "@standard-schema/spec";
import { defaultAdapterResponses } from "./lib/adapter.js";
import type { ProtocolErrorOptions } from "./lib/error.js";
import { ProtocolError } from "./lib/error.js";
import { acceptsNativePathValue } from "./lib/route.js";
import type {
	AnyAPI,
	AnyOperation,
	AnyRouteEntry,
	APIDefinition,
	ComposedAPI,
	HTTPMethod,
	NormalizedAPI,
	ResponseMap,
	RoutePaths,
} from "./lib/types.js";
import { httpMethods } from "./lib/types.js";

export {
	type AdapterErrorStatus,
	type AdapterResponse,
	type AdapterResponseInput,
	adapterResponse,
} from "./lib/adapter.js";
export { ProtocolError, type ProtocolErrorOptions } from "./lib/error.js";
export * from "./lib/types.js";

const routeKeys = new Set<string>(["route", "serialization", ...httpMethods]);
const operationKeys = new Set([
	"body",
	"operationId",
	"responses",
	"summary",
	"description",
	"tags",
	"deprecated",
	"security",
]);
const parameterNamePattern = /^:[A-Za-z_$][\w$]*$/;
// biome-ignore lint/suspicious/noControlCharactersInRegex: Contract paths reject URL control characters.
const literalSegmentPattern = /^[^:%\\?#{()*\x00-\x1f\x7f]+$/;

type DuplicateRoutePaths<
	Values extends readonly AnyAPI[],
	Seen extends string = never,
	Duplicates extends string = never,
> = Values extends readonly [infer Value extends AnyAPI, ...infer Rest extends readonly AnyAPI[]]
	? DuplicateRoutePaths<Rest, Seen | RoutePaths<Value>, Duplicates | Extract<RoutePaths<Value>, Seen>>
	: Duplicates;

type RouteDisjointAPIs<Values extends readonly AnyAPI[]> =
	string extends RoutePaths<Values[number]> ? unknown : DuplicateRoutePaths<Values> extends never ? unknown : never;

/** Options for API-wide responses applied after component-scoped composition. */
export interface ComposeAPIOptions<GlobalResponses extends ResponseMap = ResponseMap> {
	readonly responses: GlobalResponses;
	readonly routes?: never;
}

/** Validates a contract and materializes inferred routes and applicable adapter responses. */
export function defineAPI<const Definition extends APIDefinition>(
	definition: Definition & Record<Exclude<keyof Definition, keyof APIDefinition>, never>,
): NormalizedAPI<Definition> {
	if (!isObject(definition)) {
		invalidContract("The API definition must be an object");
	}

	if (Object.keys(definition).some((key) => key !== "responses" && key !== "routes")) {
		invalidContract("The API definition contains an unsupported property");
	}

	if (!isObject(definition.routes) || Object.keys(definition.routes).length === 0) {
		invalidContract("The API must declare at least one route");
	}

	const apiResponses = definition.responses ?? {};
	validateResponses(apiResponses, { apiLevel: true });

	const operationIds = new Set<string>();
	const routes: Record<string, AnyRouteEntry> = {};

	for (const [path, declaration] of Object.entries(definition.routes)) {
		if (!isObject(declaration)) {
			invalidContract("A route entry must be an object", { path });
		}
		validatePath(path);
		if (Object.hasOwn(declaration, "route") && declaration.route === undefined) {
			invalidContract("An explicit route must be a router route", { path });
		}
		const entry = { ...declaration, route: declaration.route ?? route(path) } as AnyRouteEntry;
		validateRouteEntry(path, entry, apiResponses, operationIds);
		const normalized: Record<string, unknown> = { ...entry, serialization: entry.serialization ?? "native" };
		const validatesURL = path.includes(":") || Object.keys(entry.route.options.search ?? {}).length > 0;

		for (const method of httpMethods) {
			const operation = entry[method];
			if (!operation) {
				continue;
			}
			const responses = { ...operation.responses };
			const required = operation.body ? ([400, 413, 415] as const) : validatesURL ? ([400] as const) : [];
			for (const status of required) {
				if (!Object.hasOwn(responses, status) && !Object.hasOwn(apiResponses, status)) {
					responses[status] = defaultAdapterResponses[status];
				}
			}
			normalized[method] = Object.freeze({
				...operation,
				...(operation.tags === undefined ? {} : { tags: Object.freeze([...operation.tags]) }),
				...(operation.security === undefined
					? {}
					: {
							security: Object.freeze(
								operation.security.map((requirement) =>
									Object.freeze(
										Object.fromEntries(
											Object.entries(requirement).map(([scheme, scopes]) => [
												scheme,
												Object.freeze([...scopes]),
											]),
										),
									),
								),
							),
						}),
				responses: Object.freeze(responses),
			});
		}
		routes[path] = Object.freeze(normalized) as AnyRouteEntry;
	}

	validateRouteAmbiguity(routes);

	return Object.freeze({
		...(definition.responses === undefined ? {} : { responses: Object.freeze({ ...apiResponses }) }),
		routes: Object.freeze(routes),
	}) as NormalizedAPI<Definition>;
}

/** Composes route-disjoint component APIs while retaining each component's response scope. */
export function composeAPIs<const Values extends readonly [AnyAPI, ...AnyAPI[]]>(
	...apis: Values & RouteDisjointAPIs<NoInfer<Values>>
): ComposedAPI<Values, undefined>;

/** Composes component APIs and applies an additional final API-wide response scope. */
export function composeAPIs<
	const GlobalResponses extends ResponseMap,
	const Values extends readonly [AnyAPI, ...AnyAPI[]],
>(
	options: ComposeAPIOptions<GlobalResponses>,
	...apis: Values & RouteDisjointAPIs<NoInfer<Values>>
): ComposedAPI<Values, GlobalResponses>;

export function composeAPIs(...values: readonly unknown[]): unknown {
	const options = isComposeAPIOptions(values[0]) ? values[0] : undefined;
	const apis = (options ? values.slice(1) : values) as readonly AnyAPI[];
	const routes: Record<string, AnyRouteEntry> = {};

	for (const api of apis) {
		const normalizedAPI = defineAPI(api);

		for (const [path, routeEntry] of Object.entries(normalizedAPI.routes)) {
			if (Object.hasOwn(routes, path)) {
				invalidContract("API components must declare distinct route paths", { path });
			}

			const composedRoute: Record<PropertyKey, unknown> = {
				route: routeEntry.route,
				serialization: routeEntry.serialization ?? "native",
			};

			for (const method of httpMethods) {
				const operation = routeEntry[method];

				if (operation) {
					const responses = { ...normalizedAPI.responses, ...operation.responses };

					if (options) {
						for (const status of Object.keys(options.responses)) {
							delete responses[Number(status)];
						}
					}

					composedRoute[method] = {
						...operation,
						responses,
					};
				}
			}

			routes[path] = composedRoute as AnyRouteEntry;
		}
	}

	return options ? defineAPI({ responses: options.responses, routes }) : defineAPI({ routes });
}

function validateRouteEntry(
	path: string,
	routeEntry: AnyRouteEntry,
	apiResponses: ResponseMap,
	operationIds: Set<string>,
): void {
	if (!isObject(routeEntry)) {
		invalidContract("A route entry must be an object", { path });
	}

	if (Object.keys(routeEntry).some((key) => !routeKeys.has(key))) {
		invalidContract("A route entry contains an unsupported HTTP method or property", { path });
	}

	if (!isRoute(routeEntry.route) || routeEntry.route.path !== path) {
		invalidContract("A route entry key must equal its route path", { path });
	}

	validatePath(path);

	if (
		routeEntry.serialization !== undefined &&
		routeEntry.serialization !== "native" &&
		routeEntry.serialization !== "href"
	) {
		invalidContract('A route serialization mode must be "native" or "href"', { path });
	}
	if (routeEntry.serialization !== "href") {
		validateNativeCodecs(path, routeEntry.route);
	}

	let operationCount = 0;

	for (const method of httpMethods) {
		const operation = routeEntry[method];
		if (operation === undefined) {
			continue;
		}

		++operationCount;
		validateOperation(method, path, operation, apiResponses, operationIds);
	}

	if (operationCount === 0) {
		invalidContract("A route entry must declare at least one supported HTTP method", { path });
	}
}

function validateNativeCodecs(path: string, value: AnyRoute): void {
	for (const section of [value.options?.params, value.options?.search]) {
		if (section === undefined) {
			continue;
		}
		if (!isObject(section)) {
			invalidContract("Native route codec declarations must be objects", { path });
		}

		for (const codec of Object.values(section)) {
			const metadata =
				(typeof codec === "object" || typeof codec === "function") && codec !== null
					? (codec as { readonly metadata?: unknown }).metadata
					: undefined;

			if (!isObject(metadata) || metadata.native !== true) {
				invalidContract('Custom router codecs require serialization: "href"', { path });
			}
		}
	}
}

function validateRouteAmbiguity(routes: Readonly<Record<string, AnyRouteEntry>>): void {
	const entries = Object.entries(routes).map(([path, entry]) => ({
		entry,
		path,
		segments:
			path === "/"
				? []
				: path
						.slice(1)
						.split("/")
						.map((segment) =>
							segment.startsWith(":")
								? segment
								: new URL(`/${segment}`, "https://route.invalid/").pathname.slice(1),
						),
	}));

	for (const method of httpMethods) {
		const methodRoutes = entries.filter(({ entry }) => entry[method] !== undefined);

		for (let leftIndex = 0; leftIndex < methodRoutes.length; ++leftIndex) {
			const left = methodRoutes[leftIndex]!;

			for (let rightIndex = leftIndex + 1; rightIndex < methodRoutes.length; ++rightIndex) {
				const right = methodRoutes[rightIndex]!;

				if (
					left.segments.length === right.segments.length &&
					left.segments.every((segment, index) => {
						const rightSegment = right.segments[index]!;

						if (segment.startsWith(":")) {
							return (
								rightSegment.startsWith(":") ||
								acceptsNativePathValue(left.entry, segment, rightSegment, "client")
							);
						}
						return rightSegment.startsWith(":")
							? acceptsNativePathValue(right.entry, rightSegment, segment, "client")
							: segment === rightSegment;
					})
				) {
					invalidContract("Ambiguous HTTP route templates", { method, path: left.path });
				}
			}
		}
	}
}

function isComposeAPIOptions(value: unknown): value is ComposeAPIOptions<ResponseMap> {
	return (
		isObject(value) &&
		Object.hasOwn(value, "responses") &&
		!("routes" in value) &&
		Object.keys(value).every((key) => key === "responses")
	);
}

function validateOperation(
	method: HTTPMethod,
	path: string,
	operation: AnyOperation,
	apiResponses: ResponseMap,
	operationIds: Set<string>,
): void {
	if (!isObject(operation)) {
		invalidContract("An operation must be an object", { method, path });
	}

	if (Object.keys(operation).some((key) => !operationKeys.has(key))) {
		invalidContract("An operation contains an unsupported property", { method, path });
	}

	if (
		operation.operationId !== undefined &&
		(typeof operation.operationId !== "string" || operation.operationId.length === 0)
	) {
		invalidContract("An operationId must be a non-empty string", { method, path });
	}

	const metadata = { method, path, operationId: operation.operationId };

	if (operation.operationId !== undefined) {
		if (operationIds.has(operation.operationId)) {
			invalidContract("Every operationId must be unique", metadata);
		}
		operationIds.add(operation.operationId);
	}

	if (operation.summary !== undefined && typeof operation.summary !== "string") {
		invalidContract("An operation summary must be a string", metadata);
	}
	if (operation.description !== undefined && typeof operation.description !== "string") {
		invalidContract("An operation description must be a string", metadata);
	}
	if (
		operation.tags !== undefined &&
		(!Array.isArray(operation.tags) || operation.tags.some((tag) => typeof tag !== "string"))
	) {
		invalidContract("Operation tags must be strings", metadata);
	}
	if (operation.deprecated !== undefined && typeof operation.deprecated !== "boolean") {
		invalidContract("An operation deprecated marker must be boolean", metadata);
	}
	if (
		operation.security !== undefined &&
		(!Array.isArray(operation.security) ||
			operation.security.some(
				(requirement) =>
					!isObject(requirement) ||
					Object.values(requirement).some(
						(scopes) => !Array.isArray(scopes) || scopes.some((scope) => typeof scope !== "string"),
					),
			))
	) {
		invalidContract("Operation security must contain scheme-to-scope maps", metadata);
	}

	if (method === "GET" && "body" in operation) {
		invalidContract("GET operations cannot declare a request body", metadata);
	}

	if (operation.body !== undefined && !isSchema(operation.body)) {
		invalidContract("An operation body must implement Standard Schema version 1", metadata);
	}

	validateResponses(operation.responses, metadata);

	for (const [statusKey, schema] of Object.entries(operation.responses)) {
		if (Object.hasOwn(apiResponses, statusKey) && apiResponses[Number(statusKey)] !== schema) {
			invalidContract("API-level and operation responses may overlap only when they share the same schema", {
				...metadata,
				status: Number(statusKey),
			});
		}
	}
}

function validateResponses(
	responses: ResponseMap,
	options: ProtocolErrorOptions & { readonly apiLevel?: boolean } = {},
): void {
	if (!isObject(responses)) {
		invalidContract("A response map must be an object", options);
	}

	let successful = false;

	for (const [statusKey, schema] of Object.entries(responses)) {
		if (!/^(?:2\d\d|[45]\d\d)$/.test(statusKey)) {
			invalidContract("Response statuses must be explicit 2xx, 4xx, or 5xx integers", options);
		}

		const status = Number(statusKey);
		const metadata = { ...options, status };

		if (options.apiLevel && status < 400) {
			invalidContract("API-level responses must use 4xx or 5xx statuses", metadata);
		}

		if (schema === null && status !== 204 && status !== 205) {
			invalidContract("The null no-content marker is valid only for status 204 or 205", metadata);
		}

		if (status === 204 || status === 205) {
			if (schema !== null) {
				invalidContract("Responses with status 204 or 205 must use the null no-content marker", metadata);
			}
		} else if (!isSchema(schema)) {
			invalidContract("JSON responses must implement Standard Schema version 1", metadata);
		}

		successful ||= status >= 200 && status < 300;
	}

	if (!options.apiLevel && !successful) {
		invalidContract("Every operation must declare at least one successful 2xx response", options);
	}
}

function validatePath(path: string): void {
	const segments = path === "/" ? [] : path.startsWith("/") ? path.slice(1).split("/") : [""];
	const parameterNames = new Set<string>();

	if (
		segments.some((segment) => {
			if (segment.length === 0) {
				return true;
			}

			if (!segment.startsWith(":")) {
				return segment === "." || segment === ".." || !literalSegmentPattern.test(segment);
			}
			if (!parameterNamePattern.test(segment) || parameterNames.has(segment)) {
				return true;
			}

			parameterNames.add(segment);
			return false;
		})
	) {
		invalidContract("HTTP contract paths must contain only complete literal or :parameter segments", { path });
	}
}

function isSchema(value: unknown): value is StandardSchemaV1 {
	if ((typeof value !== "object" && typeof value !== "function") || value === null) {
		return false;
	}

	const standard = (value as Partial<StandardSchemaV1>)["~standard"];

	return (
		typeof standard === "object" &&
		standard !== null &&
		standard.version === 1 &&
		typeof standard.vendor === "string" &&
		typeof standard.validate === "function"
	);
}

function isRoute(value: unknown): value is AnyRoute {
	return (
		isObject(value) &&
		typeof value.path === "string" &&
		typeof value.href === "function" &&
		typeof value.match === "function"
	);
}

function isObject(value: unknown): value is Record<PropertyKey, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function invalidContract(message: string, options?: ProtocolErrorOptions): never {
	throw new ProtocolError(message, options);
}
