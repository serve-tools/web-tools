import type { AnyRoute, RouteParams, RouteSearch } from "@serve-tools/router";
import type {
	API,
	APICommonResponses,
	HTTPMethod,
	Operation,
	OperationAt,
	PathsForMethod,
	RouteAt,
	RoutePaths,
	Schema,
	SchemaInput,
	SchemaOutput,
} from "./http-contract.js";
import { httpMethods, ProtocolError } from "./http-contract.js";
import { assertJSONValue, isJSONMediaType } from "./lib/json.js";

const DEFAULT_MAX_BODY_BYTES = 1_048_576;
const PARAMETER_SEGMENT_PATTERN = /^:[A-Za-z_$][\w$]*$/;
const rejectionBrand = Symbol("HTTP contract rejection");

const defaultErrorBodies = {
	400: () => ({ error: "invalid_request" }),
	404: () => ({ error: "not_found" }),
	405: () => ({ error: "method_not_allowed" }),
	413: () => ({ error: "request_too_large" }),
	415: () => ({ error: "unsupported_media_type" }),
} satisfies Record<AdapterErrorStatus, ErrorBodyFactory>;

type MaybePromise<Value> = Value | PromiseLike<Value>;
type SelectedRoute<Definition extends API, Path extends RoutePaths<Definition>> = RouteAt<Definition, Path>["route"];
type UnionToIntersection<Value> = (Value extends unknown ? (value: Value) => void : never) extends (
	value: infer Intersection,
) => void
	? Intersection
	: never;

type OwnResponses<Selected extends Operation> = Selected["responses"];
type ResponseStatus<Definition extends API, Selected extends Operation> =
	| (keyof OwnResponses<Selected> & number)
	| (keyof APICommonResponses<Definition> & number);
type ResponseSchemaAt<
	Definition extends API,
	Selected extends Operation,
	Status extends number,
> = Status extends keyof OwnResponses<Selected>
	? OwnResponses<Selected>[Status]
	: Status extends keyof APICommonResponses<Definition>
		? APICommonResponses<Definition>[Status]
		: never;

type RouteValues<Definition extends API, Path extends RoutePaths<Definition>> =
	SelectedRoute<Definition, Path> extends infer Value extends AnyRoute
		? {
				readonly params: RouteParams<Value>;
				readonly search: RouteSearch<Value>;
			}
		: never;

type ContextInputAt<Definition extends API, Path extends RoutePaths<Definition>> = RouteValues<Definition, Path> & {
	readonly request: Request;
	readonly signal: AbortSignal;
};

/** Input supplied to an application context and authorization hook. */
export type ContextInput<Definition extends API> = {
	[Path in RoutePaths<Definition>]: ContextInputAt<Definition, Path>;
}[RoutePaths<Definition>];

/** A typed context-hook short circuit. */
export interface Rejection<Status extends number = number, Body = unknown> {
	readonly status: Status;
	readonly body: Body;
	readonly [rejectionBrand]: true;
}

type ResponseResult<Definition extends API, Selected extends Operation> = {
	[Status in ResponseStatus<Definition, Selected>]: ResponseSchemaAt<Definition, Selected, Status> extends null
		? { readonly status: Status; readonly body?: never }
		: ResponseSchemaAt<Definition, Selected, Status> extends infer Response extends Schema
			? { readonly status: Status; readonly body: SchemaInput<Response> }
			: never;
}[ResponseStatus<Definition, Selected>];

type HandlerInputAt<
	Definition extends API,
	Method extends HTTPMethod,
	Path extends PathsForMethod<Definition, Method>,
	Context,
> = ContextInputAt<Definition, Path> &
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

/** Adapter-owned failures that may be customized without hiding their HTTP status. */
export type AdapterErrorStatus = 400 | 404 | 405 | 413 | 415;

/** Context supplied to a configured adapter error-body factory. */
export interface ErrorBodyInput {
	readonly request: Request;
	readonly status: AdapterErrorStatus;
}

/** Produces one adapter-owned JSON error body. */
export type ErrorBodyFactory = (input: ErrorBodyInput) => unknown;

/** Options for a trusted native-Fetch contract handler. */
export interface CreateHandlerOptions<Definition extends API, Context = undefined> {
	readonly context?: (input: ContextInput<Definition>) => MaybePromise<Context | Rejection>;
	readonly handlers: Handlers<Definition, NoInfer<Context>>;
	readonly maxBodyBytes?: number;
	readonly errorBodies?: Partial<Record<AdapterErrorStatus, ErrorBodyFactory>>;
}

interface RuntimeOperation extends Operation {
	readonly responses: Readonly<Record<number, Schema | null>>;
}

interface RuntimeRoute {
	readonly path: string;
	readonly segments: readonly string[];
	readonly specificity: readonly boolean[];
	readonly route: AnyRoute;
	readonly operations: ReadonlyMap<HTTPMethod, RuntimeOperation>;
}

interface RuntimeOptions {
	readonly context?: (input: ContextInput<API>) => MaybePromise<unknown | Rejection>;
	readonly handlers: Readonly<Record<string, (input: Record<string, unknown>) => MaybePromise<RuntimeResult>>>;
	readonly maxBodyBytes: number;
	readonly errorBodies?: Partial<Record<AdapterErrorStatus, ErrorBodyFactory>>;
}

interface RuntimeResult {
	readonly status: number;
	readonly body?: unknown;
}

/** Creates a branded, typed response returned early by a context hook. */
export function reject<const Status extends number, const Body>(status: Status, body: Body): Rejection<Status, Body> {
	if (!Number.isInteger(status) || status < 100 || status > 599) {
		throw new ProtocolError("A rejection must use a valid HTTP status.", { status });
	}

	return Object.freeze({ status, body, [rejectionBrand]: true as const });
}

/** Compiles one executable contract into a trusted native-Fetch request handler. */
export function createHandler<const Definition extends API, Context = undefined>(
	api: Definition,
	options: CreateHandlerOptions<NoInfer<Definition>, Context>,
): (request: Request) => Promise<Response> {
	const maxBodyBytes = options.maxBodyBytes ?? DEFAULT_MAX_BODY_BYTES;

	if (!Number.isSafeInteger(maxBodyBytes) || maxBodyBytes <= 0) {
		throw new ProtocolError("maxBodyBytes must be a positive safe integer.");
	}

	const routes = compileRoutes(api);
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

			if (entry.operations.has(method) && (!selected || compareSpecificity(entry, selected) < 0)) {
				selected = entry;
			}
		}

		if (candidates.length === 0) {
			return adapterError(api, runtimeOptions, request, 404);
		}

		if (!selected) {
			const allow = httpMethods
				.filter((value) => candidates.some((entry) => entry.operations.has(value)))
				.join(", ");

			return adapterError(api, runtimeOptions, request, 405, undefined, undefined, { Allow: allow });
		}

		const operation = selected.operations.get(method)!;
		const match = selected.route.match(url);

		if (match === null) {
			return adapterError(api, runtimeOptions, request, 400, selected, operation);
		}

		const baseInput = {
			request,
			signal: request.signal,
			params: match.params,
			search: match.search,
		};
		let context: unknown;

		if (runtimeOptions.context) {
			context = await runtimeOptions.context(baseInput as ContextInput<API>);

			if (isRejection(context)) {
				return operationResponse(api, request, selected, operation, context);
			}
		}

		let body: unknown;

		if (operation.body) {
			if (!isJSONMediaType(request.headers.get("content-type"))) {
				return adapterError(api, runtimeOptions, request, 415, selected, operation);
			}

			const bytes = await readBody(request, maxBodyBytes);

			if (bytes === null) {
				return adapterError(api, runtimeOptions, request, 413, selected, operation);
			}

			let value: unknown;

			try {
				value = JSON.parse(new TextDecoder().decode(bytes));
			} catch {
				return adapterError(api, runtimeOptions, request, 400, selected, operation);
			}

			const validation = await operation.body["~standard"].validate(value);

			if (validation.issues) {
				return adapterError(api, runtimeOptions, request, 400, selected, operation);
			}

			body = validation.value;
		}

		const key = `${method} ${selected.path}`;
		const handler = runtimeOptions.handlers[key];

		if (!handler) {
			throw protocolError("A declared operation is missing its handler.", request, selected, operation);
		}

		const result = await handler({ ...baseInput, context, ...(operation.body ? { body } : {}) });

		return operationResponse(api, request, selected, operation, result);
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
			operations,
		};
	});

	for (const method of httpMethods) {
		const methodRoutes = routes.filter((entry) => entry.operations.has(method));

		for (let leftIndex = 0; leftIndex < methodRoutes.length; ++leftIndex) {
			const left = methodRoutes[leftIndex]!;

			for (let rightIndex = leftIndex + 1; rightIndex < methodRoutes.length; ++rightIndex) {
				const right = methodRoutes[rightIndex]!;

				if (sameSpecificity(left, right) && routesOverlap(left, right)) {
					throw new ProtocolError("Ambiguous HTTP route templates.", { method, path: left.path });
				}
			}
		}
	}

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

function sameSpecificity(left: RuntimeRoute, right: RuntimeRoute): boolean {
	return (
		left.specificity.length === right.specificity.length &&
		left.specificity.every((literal, index) => literal === right.specificity[index])
	);
}

function routesOverlap(left: RuntimeRoute, right: RuntimeRoute): boolean {
	if (left.segments.length !== right.segments.length) {
		return false;
	}

	return left.segments.every(
		(segment, index) => !left.specificity[index] || !right.specificity[index] || segment === right.segments[index],
	);
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
	options: RuntimeOptions,
	request: Request,
	status: AdapterErrorStatus,
	route?: RuntimeRoute,
	operation?: RuntimeOperation,
	headers?: HeadersInit,
): Promise<Response> {
	const body = (options.errorBodies?.[status] ?? defaultErrorBodies[status])({ request, status });
	const schema = operation && responseSchema(api, operation, status);
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
	result: RuntimeResult | Rejection,
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

	if (schema === null) {
		if (Object.hasOwn(result, "body")) {
			throw protocolError("A no-content response included a body.", request, route, operation, result.status);
		}

		return new Response(null, { status: result.status });
	}

	if (!Object.hasOwn(result, "body")) {
		throw protocolError("A JSON response omitted its body.", request, route, operation, result.status);
	}

	const validation = await schema["~standard"].validate(result.body);

	if (validation.issues) {
		throw protocolError("A handler returned an invalid response body.", request, route, operation, result.status);
	}

	assertJSONValue(validation.value, "an HTTP response");

	return jsonResponse(validation.value, result.status);
}

function responseSchema(api: API, operation: RuntimeOperation, status: number): Schema | null | undefined {
	if (Object.hasOwn(operation.responses, status)) {
		return operation.responses[status];
	}

	return api.commonResponses?.[status];
}

function jsonResponse(body: unknown, status: number, headers?: HeadersInit): Response {
	const responseHeaders = new Headers(headers);

	responseHeaders.set("Content-Type", "application/json");

	return new Response(JSON.stringify(body), { status, headers: responseHeaders });
}

function isRejection(value: unknown): value is Rejection {
	return typeof value === "object" && value !== null && (value as Partial<Rejection>)[rejectionBrand] === true;
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
