import type { AnyRoute } from "@serve-tools/router";
import type { StandardSchemaV1 } from "@standard-schema/spec";
import type { AnyAPI, AnyOperation, AnyRouteEntry, HTTPMethod, ResponseMap } from "./lib/types.js";
import { httpMethods } from "./lib/types.js";

export * from "./lib/types.js";

const routeKeys = new Set<string>(["route", "serialization", ...httpMethods]);
const operationKeys = new Set(["body", "operationId", "responses", "summary"]);
const parameterNamePattern = /^:[A-Za-z_$][\w$]*$/;
// biome-ignore lint/suspicious/noControlCharactersInRegex: Contract paths reject URL control characters.
const literalSegmentPattern = /^[^:%\\?#{()*\x00-\x1f\x7f]+$/;

/** Safe metadata attached to a local HTTP contract failure. */
export interface ProtocolErrorOptions {
	readonly method?: string | undefined;
	readonly path?: string | undefined;
	readonly status?: number | undefined;
	readonly operationId?: string | undefined;
	readonly cause?: unknown;
}

/** A local HTTP contract or protocol failure that is not an HTTP response. */
export class ProtocolError extends Error {
	readonly method: string | undefined;
	readonly path: string | undefined;
	readonly status: number | undefined;
	readonly operationId: string | undefined;

	constructor(message: string, options: ProtocolErrorOptions = {}) {
		super(message, options.cause === undefined ? undefined : { cause: options.cause });

		this.name = "ProtocolError";
		this.method = options.method;
		this.path = options.path;
		this.status = options.status;
		this.operationId = options.operationId;
	}
}

/** Declares and validates one literal-preserving HTTP API contract. */
export function defineAPI<const Definition extends AnyAPI>(definition: Definition): Definition {
	if (!isObject(definition)) {
		invalidContract("The API definition must be an object");
	}

	if (Object.keys(definition).some((key) => key !== "commonResponses" && key !== "routes")) {
		invalidContract("The API definition contains an unsupported property");
	}

	if (!isObject(definition.routes) || Object.keys(definition.routes).length === 0) {
		invalidContract("The API must declare at least one route");
	}

	const commonResponses = definition.commonResponses ?? {};
	validateResponses(commonResponses, { common: true });

	const operationIds = new Set<string>();

	for (const [path, routeEntry] of Object.entries(definition.routes)) {
		validateRouteEntry(path, routeEntry, commonResponses, operationIds);
	}

	return definition;
}

function validateRouteEntry(
	path: string,
	routeEntry: AnyRouteEntry,
	commonResponses: ResponseMap,
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

	if (routeEntry.serialization !== "native" && routeEntry.serialization !== "href") {
		invalidContract('A route serialization mode must be "native" or "href"', { path });
	}

	let operationCount = 0;

	for (const method of httpMethods) {
		const operation = routeEntry[method];
		if (operation === undefined) {
			continue;
		}

		++operationCount;
		validateOperation(method, path, operation, commonResponses, operationIds);
	}

	if (operationCount === 0) {
		invalidContract("A route entry must declare at least one supported HTTP method", { path });
	}
}

function validateOperation(
	method: HTTPMethod,
	path: string,
	operation: AnyOperation,
	commonResponses: ResponseMap,
	operationIds: Set<string>,
): void {
	if (!isObject(operation)) {
		invalidContract("An operation must be an object", { method, path });
	}

	if (Object.keys(operation).some((key) => !operationKeys.has(key))) {
		invalidContract("An operation contains an unsupported property", { method, path });
	}

	if (typeof operation.operationId !== "string" || operation.operationId.length === 0) {
		invalidContract("An operationId must be a non-empty string", { method, path });
	}

	const metadata = { method, path, operationId: operation.operationId };

	if (operationIds.has(operation.operationId)) {
		invalidContract("Every operationId must be unique", metadata);
	}

	operationIds.add(operation.operationId);

	if (operation.summary !== undefined && typeof operation.summary !== "string") {
		invalidContract("An operation summary must be a string", metadata);
	}

	if (method === "GET" && "body" in operation) {
		invalidContract("GET operations cannot declare a request body", metadata);
	}

	if (operation.body !== undefined && !isSchema(operation.body)) {
		invalidContract("An operation body must implement Standard Schema version 1", metadata);
	}

	validateResponses(operation.responses, metadata);

	for (const [statusKey, schema] of Object.entries(operation.responses)) {
		if (Object.hasOwn(commonResponses, statusKey) && commonResponses[Number(statusKey)] !== schema) {
			invalidContract("Common and operation responses may overlap only when they share the same schema", {
				...metadata,
				status: Number(statusKey),
			});
		}
	}
}

function validateResponses(
	responses: ResponseMap,
	options: ProtocolErrorOptions & { readonly common?: boolean } = {},
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

		if (options.common && status < 400) {
			invalidContract("Common responses must use 4xx or 5xx statuses", metadata);
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

	if (!options.common && !successful) {
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
