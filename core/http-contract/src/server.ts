import type { AnyRoute, RouteParams, RouteSearch } from "@serve-tools/router";
import type {
	API,
	APIResponses,
	HTTPMethod,
	NormalizedResponseMap,
	Operation,
	OperationAt,
	OperationResponses,
	PathsForMethod,
	ResponseMapAt,
	ResponseMapStatuses,
	RouteAt,
	RoutePaths,
	Schema,
	SchemaInput,
	SchemaOutput,
	SerializationMode,
} from "./http-contract.js";
import { defineAPI, httpMethods, ProtocolError } from "./http-contract.js";
import type { AdapterErrorStatus } from "./lib/adapter.js";
import { adapterResponseBody } from "./lib/adapter.js";
import { assertJSONValue, isJSONMediaType } from "./lib/json.js";
import { acceptsNativePathValue } from "./lib/route.js";

const DEFAULT_MAX_BODY_BYTES = 1_048_576;
const PARAMETER_SEGMENT_PATTERN = /^:[A-Za-z_$][\w$]*$/;
const contextResponseBrand = Symbol("HTTP contract context response");

type MaybePromise<Value> = Value | PromiseLike<Value>;
type SelectedRoute<Definition extends API, Path extends RoutePaths<Definition>> = RouteAt<Definition, Path>["route"];
type UnionToIntersection<Value> = (Value extends unknown ? (value: Value) => void : never) extends (
	value: infer Intersection,
) => void
	? Intersection
	: never;

type OwnResponses<Selected extends Operation> = NormalizedResponseMap<Selected["responses"]>;
type RouteValues<Definition extends API, Path extends RoutePaths<Definition>> =
	SelectedRoute<Definition, Path> extends infer Value extends AnyRoute
		? {
				readonly params: RouteParams<Value>;
				readonly search: RouteSearch<Value>;
			}
		: never;

type RequestInputAt<Definition extends API, Path extends RoutePaths<Definition>> = RouteValues<Definition, Path> & {
	readonly request: Request;
	readonly signal: AbortSignal;
};

/** A typed context-hook short circuit. */
export interface ContextResponse extends ResponseOptions {
	readonly status: number;
	readonly body?: unknown;
	readonly [contextResponseBrand]: true;
}

/** Application response metadata; JSON media type and payload framing remain adapter-owned. */
export interface ResponseOptions {
	readonly headers?: HeadersInit;
}

type ResponseValue<Responses extends object> = ResponseOptions &
	(number extends ResponseMapStatuses<Responses>
		? { readonly status: number; readonly body?: unknown }
		: {
				[Status in ResponseMapStatuses<Responses>]: ResponseMapAt<Responses, Status> extends null
					? { readonly status: Status; readonly body?: never }
					: ResponseMapAt<Responses, Status> extends infer Response extends Schema
						? { readonly status: Status; readonly body: SchemaInput<Response> }
						: never;
			}[ResponseMapStatuses<Responses>]);

type ResponseResult<Definition extends API, Selected extends Operation> = ResponseValue<
	OperationResponses<Definition, Selected>
>;

type Respond<Definition extends API, Selected extends Operation> = {
	(result: ResponseValue<APIResponses<Definition>>): ContextResponse;
	(result: ResponseValue<OwnResponses<Selected>>): ContextResponse;
};

type ContextInputAt<
	Definition extends API,
	Method extends HTTPMethod,
	Path extends PathsForMethod<Definition, Method>,
> = RequestInputAt<Definition, Path> & {
	readonly method: Method;
	readonly path: Path;
	readonly respond: Respond<Definition, OperationAt<Definition, Method, Path>>;
};

/** Input supplied to an application context and authorization hook. */
export type ContextInput<Definition extends API> = {
	[Method in HTTPMethod]: {
		[Path in PathsForMethod<Definition, Method>]: ContextInputAt<Definition, Method, Path>;
	}[PathsForMethod<Definition, Method>];
}[HTTPMethod];

type HandlerInputAt<
	Definition extends API,
	Method extends HTTPMethod,
	Path extends PathsForMethod<Definition, Method>,
	Context,
> = RequestInputAt<Definition, Path> &
	(OperationAt<Definition, Method, Path> extends { readonly body: infer Body extends Schema }
		? { readonly body: SchemaOutput<Body> }
		: { readonly body?: never }) & { readonly context: Context };

type HandlersForMethod<Definition extends API, Method extends HTTPMethod, Context> = {
	[Path in PathsForMethod<Definition, Method> as `${Method} ${Path}`]: (
		input: HandlerInputAt<Definition, Method, Path, Context>,
	) =>
		| ResponseResult<Definition, OperationAt<Definition, Method, Path>>
		| Promise<ResponseResult<Definition, OperationAt<Definition, Method, Path>>>;
};

/** An application's fully typed operation-handler map. */
export type Handlers<Definition extends API, Context = undefined> =
	UnionToIntersection<
		{
			[Method in HTTPMethod]: HandlersForMethod<Definition, Method, Context>;
		}[HTTPMethod]
	> extends infer HandlerMap
		? { [Key in keyof HandlerMap]: HandlerMap[Key] }
		: never;

/** Options for a trusted native-Fetch contract handler. */
export interface CreateHandlerOptions<Definition extends API, Context = undefined> {
	readonly context?: (input: ContextInput<Definition>) => MaybePromise<Context | ContextResponse>;
	readonly handlers: Handlers<Definition, NoInfer<Context>>;
	readonly maxBodyBytes?: number;
}

interface RuntimeOperation extends Operation {
	readonly responses: Readonly<Record<number, Schema | null>>;
}

interface RuntimeRoute {
	readonly path: string;
	readonly segments: readonly string[];
	readonly specificity: readonly boolean[];
	readonly route: AnyRoute;
	readonly serialization: SerializationMode | undefined;
	readonly operations: ReadonlyMap<HTTPMethod, RuntimeOperation>;
}

interface RuntimeOptions {
	readonly context?: (input: RuntimeContextInput) => MaybePromise<unknown | ContextResponse>;
	readonly handlers: Readonly<Record<string, (input: Record<string, unknown>) => MaybePromise<RuntimeResult>>>;
	readonly maxBodyBytes: number;
}

interface RuntimeResult extends ResponseOptions {
	readonly status: number;
	readonly body?: unknown;
}

interface RuntimeContextInput extends Record<string, unknown> {
	readonly method: HTTPMethod;
	readonly path: string;
	readonly respond: typeof respond;
}

function respond(result: RuntimeResult): ContextResponse {
	if (
		typeof result !== "object" ||
		result === null ||
		Array.isArray(result) ||
		Object.keys(result).some((key) => key !== "status" && key !== "body" && key !== "headers") ||
		!Number.isInteger(result.status) ||
		result.status < 100 ||
		result.status > 599
	) {
		throw new ProtocolError("A context response must use a valid response result.");
	}
	if ((result.status === 204 || result.status === 205) && Object.hasOwn(result, "body")) {
		throw new ProtocolError("A no-content context response included a body.", { status: result.status });
	}

	return Object.freeze({ ...result, [contextResponseBrand]: true as const });
}

/** Compiles one executable contract into a trusted native-Fetch request handler. */
export function createHandler<const Definition extends API, Context = undefined>(
	api: Definition,
	options: CreateHandlerOptions<NoInfer<Definition>, Context>,
): (request: Request) => Promise<Response> {
	if (
		typeof options !== "object" ||
		options === null ||
		"errorBodies" in options ||
		Reflect.ownKeys(options).some((key) => key !== "context" && key !== "handlers" && key !== "maxBodyBytes")
	) {
		throw new ProtocolError(
			"Invalid handler options; use adapterResponse() in the contract to customize adapter errors.",
		);
	}
	const maxBodyBytes = options.maxBodyBytes ?? DEFAULT_MAX_BODY_BYTES;

	if (!Number.isSafeInteger(maxBodyBytes) || maxBodyBytes <= 0) {
		throw new ProtocolError("maxBodyBytes must be a positive safe integer.");
	}

	const normalized = defineAPI<API>(api);
	const routes = compileRoutes(normalized);
	const runtimeOptions = { ...options, maxBodyBytes } as unknown as RuntimeOptions;
	validateHandlers(routes, runtimeOptions.handlers);

	return async function handle(request) {
		const url = new URL(request.url);
		const pathname = url.pathname;
		const segments = pathname === "/" ? [] : pathname.slice(1).split("/");
		const candidates: RuntimeRoute[] = [];
		const method = request.method as HTTPMethod;
		let selected: RuntimeRoute | undefined;

		for (const entry of routes) {
			if (!matchesPathname(entry, segments)) {
				continue;
			}

			candidates.push(entry);
		}

		if (candidates.length === 0) {
			return adapterError(normalized, request, 404);
		}
		const nativeCandidates = candidates.filter((entry) =>
			entry.segments.every(
				(segment, index) =>
					entry.specificity[index] || acceptsNativePathValue(entry, segment, segments[index]!, "request"),
			),
		);
		const matching = nativeCandidates.length ? nativeCandidates : candidates;
		for (const entry of matching) {
			if (entry.operations.has(method) && (!selected || compareSpecificity(entry, selected) < 0)) {
				selected = entry;
			}
		}

		if (!selected) {
			const allow = httpMethods
				.filter((value) => matching.some((entry) => entry.operations.has(value)))
				.join(", ");

			return adapterError(normalized, request, 405, undefined, undefined, { Allow: allow }, matching);
		}

		const operation = selected.operations.get(method)!;
		const match = selected.route.match(url);

		if (match === null) {
			return adapterError(normalized, request, 400, selected, operation);
		}

		const baseInput = {
			request,
			signal: request.signal,
			params: match.params,
			search: match.search,
		};
		let context: unknown;

		if (runtimeOptions.context) {
			context = await runtimeOptions.context({ ...baseInput, method, path: selected.path, respond });

			if (isContextResponse(context)) {
				return operationResponse(normalized, request, selected, operation, context);
			}
		}

		let body: unknown;

		if (operation.body) {
			if (!isJSONMediaType(request.headers.get("content-type"))) {
				return adapterError(normalized, request, 415, selected, operation);
			}

			const bytes = await readBody(request, maxBodyBytes);

			if (bytes === null) {
				return adapterError(normalized, request, 413, selected, operation);
			}

			let value: unknown;

			try {
				value = JSON.parse(new TextDecoder().decode(bytes));
			} catch {
				return adapterError(normalized, request, 400, selected, operation);
			}

			const validation = await operation.body["~standard"].validate(value);

			if (validation.issues) {
				return adapterError(normalized, request, 400, selected, operation);
			}

			body = validation.value;
		}

		const key = `${method} ${selected.path}`;
		const handler = runtimeOptions.handlers[key];

		if (!handler) {
			throw protocolError("A declared operation is missing its handler.", request, selected, operation);
		}

		const result = await handler({ ...baseInput, context, ...(operation.body ? { body } : {}) });

		return operationResponse(normalized, request, selected, operation, result);
	};
}

function compileRoutes(api: API): RuntimeRoute[] {
	const routes = Object.entries(api.routes).map(([path, contract]) => {
		const segments = pathSegments(path);
		const operations = new Map<HTTPMethod, RuntimeOperation>();

		for (const method of httpMethods) {
			const operation = contract[method];

			if (operation) {
				operations.set(method, operation as RuntimeOperation);
			}
		}
		return {
			path,
			segments,
			specificity: segments.map((segment) => !PARAMETER_SEGMENT_PATTERN.test(segment)),
			route: contract.route,
			serialization: contract.serialization,
			operations,
		};
	});

	return routes;
}

function validateHandlers(
	routes: readonly RuntimeRoute[],
	handlers: Readonly<Record<string, (input: Record<string, unknown>) => MaybePromise<RuntimeResult>>>,
): void {
	for (const route of routes) {
		for (const [method, operation] of route.operations) {
			if (typeof handlers[`${method} ${route.path}`] !== "function") {
				throw new ProtocolError("A declared operation is missing its handler.", {
					method,
					path: route.path,
					operationId: operation.operationId,
				});
			}
		}
	}
}

function pathSegments(path: string): string[] {
	const segments = path === "/" ? [] : path.slice(1).split("/");

	if (
		segments.some(
			(segment) => segment === "" || (segment.includes(":") && !PARAMETER_SEGMENT_PATTERN.test(segment)),
		)
	) {
		throw new ProtocolError("HTTP route paths require complete literal or parameter segments.", { path });
	}

	return segments;
}

function matchesPathname(route: RuntimeRoute, requestSegments: readonly string[]): boolean {
	if (route.segments.length !== requestSegments.length) {
		return false;
	}

	return route.segments.every((segment, index) => {
		const value = requestSegments[index]!;

		if (!route.specificity[index]) {
			return value !== "";
		}

		return (
			segment === value ||
			((value.includes("%") || segment.includes(" ")) &&
				new URL(segment, "https://route.invalid/").pathname.slice(1) === value)
		);
	});
}

function compareSpecificity(left: RuntimeRoute, right: RuntimeRoute): number {
	for (let index = 0; index < left.specificity.length; ++index) {
		if (left.specificity[index] === right.specificity[index]) {
			continue;
		}

		return left.specificity[index] ? -1 : 1;
	}

	return left.path.localeCompare(right.path);
}

async function readBody(request: Request, maxBodyBytes: number): Promise<Uint8Array | null> {
	const contentLength = request.headers.get("content-length");

	if (contentLength && /^\d+$/.test(contentLength) && Number(contentLength) > maxBodyBytes) {
		await cancelBody(request.body);

		return null;
	}

	if (request.body === null) {
		return new Uint8Array();
	}

	const reader = request.body.getReader();
	const chunks: Uint8Array[] = [];
	let byteLength = 0;

	try {
		while (true) {
			const chunk = await reader.read();

			if (chunk.done) {
				break;
			}

			byteLength += chunk.value.byteLength;

			if (byteLength > maxBodyBytes) {
				await cancelReader(reader);

				return null;
			}

			chunks.push(chunk.value);
		}
	} finally {
		reader.releaseLock();
	}

	const body = new Uint8Array(byteLength);
	let offset = 0;

	for (const chunk of chunks) {
		body.set(chunk, offset);
		offset += chunk.byteLength;
	}

	return body;
}

async function cancelBody(body: ReadableStream<Uint8Array> | null): Promise<void> {
	try {
		await body?.cancel();
	} catch {
		// Cancellation is best-effort after the adapter has already selected a 413 response.
	}
}

async function cancelReader(reader: ReadableStreamDefaultReader<Uint8Array>): Promise<void> {
	try {
		await reader.cancel();
	} catch {
		// Cancellation is best-effort after the adapter has already selected a 413 response.
	}
}

async function adapterError(
	api: API,
	request: Request,
	status: AdapterErrorStatus,
	route?: RuntimeRoute,
	operation?: RuntimeOperation,
	headers?: HeadersInit,
	candidates?: readonly RuntimeRoute[],
): Promise<Response> {
	const schema = operation
		? responseSchema(api, operation, status)
		: status === 405
			? (apiResponseSchema(api, status) ?? candidateResponseSchema(api, candidates ?? [], status, request))
			: apiResponseSchema(api, status);

	if (operation && schema === undefined) {
		throw protocolError(
			"An adapter error status is undeclared for the matched operation.",
			request,
			route,
			operation,
			status,
		);
	}

	const body = await adapterResponseBody(schema, { request, status });
	let output = body;

	if (schema) {
		const validation = await schema["~standard"].validate(body);

		if (validation.issues) {
			throw protocolError(
				"An adapter error body failed its declared response schema.",
				request,
				route,
				operation,
				status,
			);
		}

		output = validation.value;
	}

	assertJSONValue(output, "an HTTP error response");

	return jsonResponse(output, status, headers);
}

async function operationResponse(
	api: API,
	request: Request,
	route: RuntimeRoute,
	operation: RuntimeOperation,
	result: RuntimeResult | ContextResponse,
): Promise<Response> {
	if (
		typeof result !== "object" ||
		result === null ||
		Array.isArray(result) ||
		typeof result.status !== "number" ||
		!Number.isInteger(result.status)
	) {
		throw protocolError("A handler returned an invalid response result.", request, route, operation);
	}

	const schema = responseSchema(api, operation, result.status);

	if (schema === undefined) {
		throw protocolError("A handler returned an undeclared status.", request, route, operation, result.status);
	}

	let headers: Headers;
	try {
		headers = new Headers(result.headers);
	} catch {
		throw protocolError("A handler returned invalid response headers.", request, route, operation, result.status);
	}
	for (const name of ["content-type", "content-length", "content-encoding", "transfer-encoding"]) {
		if (headers.has(name)) {
			throw protocolError(
				"Response media type and payload framing headers are adapter-owned.",
				request,
				route,
				operation,
				result.status,
			);
		}
	}

	if (schema === null) {
		if (Object.hasOwn(result, "body")) {
			throw protocolError("A no-content response included a body.", request, route, operation, result.status);
		}

		return new Response(null, { status: result.status, headers });
	}

	if (!Object.hasOwn(result, "body")) {
		throw protocolError("A JSON response omitted its body.", request, route, operation, result.status);
	}

	const validation = await schema["~standard"].validate(result.body);

	if (validation.issues) {
		throw protocolError("A handler returned an invalid response body.", request, route, operation, result.status);
	}

	assertJSONValue(validation.value, "an HTTP response");

	return jsonResponse(validation.value, result.status, headers);
}

function responseSchema(api: API, operation: RuntimeOperation, status: number): Schema | null | undefined {
	if (Object.hasOwn(operation.responses, status)) {
		return operation.responses[status];
	}

	return apiResponseSchema(api, status);
}

function apiResponseSchema(api: API, status: number): Schema | null | undefined {
	return api.responses && Object.hasOwn(api.responses, status) ? api.responses[status] : undefined;
}

function candidateResponseSchema(
	api: API,
	candidates: readonly RuntimeRoute[],
	status: AdapterErrorStatus,
	request: Request,
): Schema | null | undefined {
	let selected: Schema | null | undefined;

	for (const candidate of candidates) {
		for (const operation of candidate.operations.values()) {
			const schema = responseSchema(api, operation, status);

			if (schema === undefined) {
				continue;
			}

			if (selected !== undefined && selected !== schema) {
				throw protocolError(
					"Matching routes declare conflicting adapter error schemas.",
					request,
					undefined,
					undefined,
					status,
				);
			}

			selected = schema;
		}
	}

	return selected;
}

function jsonResponse(body: unknown, status: number, headers?: HeadersInit): Response {
	const responseHeaders = new Headers(headers);

	responseHeaders.set("Content-Type", "application/json");

	return new Response(JSON.stringify(body), { status, headers: responseHeaders });
}

function isContextResponse(value: unknown): value is ContextResponse {
	return (
		typeof value === "object" &&
		value !== null &&
		(value as Partial<ContextResponse>)[contextResponseBrand] === true
	);
}

function protocolError(
	message: string,
	request: Request,
	route?: RuntimeRoute,
	operation?: RuntimeOperation,
	status?: number,
): ProtocolError {
	return new ProtocolError(message, {
		method: request.method,
		path: route?.path,
		operationId: operation?.operationId,
		status,
	});
}
