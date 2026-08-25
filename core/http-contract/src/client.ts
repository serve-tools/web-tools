import type { AnyRoute, RouteInput } from "@serve-tools/router";

import type {
	API,
	HTTPMethod,
	Operation,
	OperationAt,
	OperationResponses,
	PathsForMethod,
	ResponseSchema,
	RouteAt,
	RoutePaths,
	Schema,
	SchemaInput,
	SchemaOutput,
} from "./http-contract.js";
import { httpMethods, ProtocolError } from "./http-contract.js";
import { assertJSONValue, isJSONMediaType } from "./lib/json.js";

const CLIENT_BASE_URL = "https://http-contract.invalid/";
const PARAMETER_SEGMENT_PATTERN = /^:([A-Za-z_$][\w$]*)$/;
// biome-ignore lint/suspicious/noControlCharactersInRegex: Client route templates reject URL control characters.
const INVALID_LITERAL_PATTERN = /[:%\\?#{()*\u0000-\u001f\u007f]/;

declare const resultResponses: unique symbol;

/** Options shared by every generated client request. */
export interface ClientRequestOptions {
	readonly credentials?: RequestCredentials;
	readonly headers?: HeadersInit;
	readonly signal?: AbortSignal;
}

/** Configuration for a schema-free native Fetch client. */
export interface ClientOptions {
	readonly baseURL?: string | URL;
	readonly fetch?: typeof globalThis.fetch;
}

interface ResultAssociation<Responses> {
	readonly [resultResponses]: (responses: Responses) => Responses;
}

/** An honest JSON, no-content, or unverified raw HTTP response. */
export type HTTPResult<Responses extends object> = (
	| {
			readonly kind: "json";
			readonly ok: true;
			readonly status: number;
			readonly data: unknown;
			readonly response: Response;
	  }
	| {
			readonly kind: "json";
			readonly ok: false;
			readonly status: number;
			readonly error: unknown;
			readonly response: Response;
	  }
	| {
			readonly kind: "empty";
			readonly ok: true;
			readonly status: number;
			readonly data: undefined;
			readonly response: Response;
	  }
	| {
			readonly kind: "raw";
			readonly ok: boolean;
			readonly status: number;
			readonly response: Response;
			readonly body?: string;
	  }
) &
	ResultAssociation<Responses>;

type ClientMethods<Definition extends API> = {
	[Method in HTTPMethod]: PathsForMethod<Definition, Method> extends never ? never : Method;
}[HTTPMethod];

type NativeRouteOptions<Definition extends API, Path extends RoutePaths<Definition>> =
	RouteAt<Definition, Path> extends {
		readonly route: infer SelectedRoute extends AnyRoute;
		readonly serialization: "native";
	}
		? RouteInput<SelectedRoute> & { readonly href?: never }
		: never;

type HrefRouteOptions<Definition extends API, Path extends RoutePaths<Definition>> =
	RouteAt<Definition, Path> extends { readonly serialization: "href" }
		? { readonly href: string; readonly params?: never; readonly search?: never }
		: never;

type RouteRequestOptions<Definition extends API, Path extends RoutePaths<Definition>> =
	| NativeRouteOptions<Definition, Path>
	| HrefRouteOptions<Definition, Path>;

type BodyRequestOptions<Selected extends Operation> = Selected extends { readonly body: infer Body extends Schema }
	? { readonly body: SchemaInput<Body> }
	: { readonly body?: never };

type RequestOptions<
	Definition extends API,
	Path extends RoutePaths<Definition>,
	Selected extends Operation,
> = ClientRequestOptions & RouteRequestOptions<Definition, Path> & BodyRequestOptions<Selected>;

type RequestArguments<Options> = Record<never, never> extends Options ? [options?: Options] : [options: Options];

type ClientResponseStatus<Responses> = keyof Responses & number;
type ClientResponseAt<Responses, Status extends ClientResponseStatus<Responses>> = Responses[Status] & ResponseSchema;

type CheckedHTTPResult<Responses extends object, Status extends ClientResponseStatus<Responses>> = (ClientResponseAt<
	Responses,
	Status
> extends null
	? {
			readonly kind: "empty";
			readonly ok: true;
			readonly status: Status;
			readonly data: undefined;
			readonly response: Response;
		}
	: `${Status}` extends `2${string}`
		? {
				readonly kind: "json";
				readonly ok: true;
				readonly status: Status;
				readonly data: SchemaOutput<Extract<ClientResponseAt<Responses, Status>, Schema>>;
				readonly response: Response;
			}
		: {
				readonly kind: "json";
				readonly ok: false;
				readonly status: Status;
				readonly error: SchemaOutput<Extract<ClientResponseAt<Responses, Status>, Schema>>;
				readonly response: Response;
			}) &
	ResultAssociation<Responses>;

/** A client whose methods, paths, route inputs, bodies, and declared status checks derive from one API type. */
export type Client<Definition extends API> = {
	[Method in ClientMethods<Definition>]: <Path extends PathsForMethod<Definition, Method>>(
		path: Path,
		...args: RequestArguments<RequestOptions<Definition, Path, OperationAt<Definition, Method, Path>>>
	) => Promise<HTTPResult<OperationResponses<Definition, OperationAt<Definition, Method, Path>>>>;
};

interface RuntimeRequestOptions {
	readonly body?: unknown;
	readonly credentials?: RequestCredentials;
	readonly headers?: HeadersInit;
	readonly href?: unknown;
	readonly params?: unknown;
	readonly search?: unknown;
	readonly signal?: AbortSignal;
}

/** Creates a client whose application contract remains a fully erased type argument. */
export function createClient<Definition extends API>({
	baseURL,
	fetch: fetchImplementation = globalThis.fetch,
}: ClientOptions = {}): Client<Definition> {
	const base = baseURL === undefined ? undefined : parseBaseURL(baseURL);
	const client: Partial<Record<HTTPMethod, unknown>> = {};

	for (const method of httpMethods) {
		client[method] = async (path: string, input?: unknown) => {
			const options = requestOptions(method, path, input);
			const href = Object.hasOwn(options, "href")
				? serializeHref(method, path, options)
				: serializeNative(method, path, options);
			const url = resolveURL(method, path, href, base);
			const headers = new Headers(options.headers);

			headers.set("accept", "application/json");

			let body: string | undefined;

			if (Object.hasOwn(options, "body")) {
				assertJSONValue(options.body, "the client request body");
				headers.set("content-type", "application/json");
				body = JSON.stringify(options.body);
			}

			const response = await fetchImplementation(url, {
				method,
				headers,
				...(body === undefined ? {} : { body }),
				...(options.credentials === undefined ? {} : { credentials: options.credentials }),
				...(options.signal === undefined ? {} : { signal: options.signal }),
			});

			return (await readResponse(response)) as HTTPResult<object>;
		};
	}

	return client as Client<Definition>;
}

/** Checks one operation-declared status before exposing the payload type trusted from its server validator. */
export function isStatus<Responses extends object, const Status extends ClientResponseStatus<Responses>>(
	result: HTTPResult<Responses>,
	status: Status,
): result is HTTPResult<Responses> & CheckedHTTPResult<Responses, Status> {
	if (result.status !== status || result.kind === "raw") {
		return false;
	}

	if (status === 204 || status === 205) {
		return result.kind === "empty";
	}

	return result.kind === "json" && result.ok === (status >= 200 && status < 300);
}

async function readResponse(response: Response): Promise<HTTPResult<object>> {
	const result = { ok: response.ok, status: response.status, response };

	if (response.status === 204 || response.status === 205) {
		return { ...result, kind: "empty", ok: true, data: undefined } as HTTPResult<object>;
	}

	if (!isJSONMediaType(response.headers.get("content-type"))) {
		return { ...result, kind: "raw" } as HTTPResult<object>;
	}

	const body = await response.text();
	let value: unknown;

	try {
		value = JSON.parse(body);
	} catch {
		return { ...result, kind: "raw", body } as HTTPResult<object>;
	}

	return (
		response.ok
			? { ...result, kind: "json", ok: true, data: value }
			: { ...result, kind: "json", ok: false, error: value }
	) as HTTPResult<object>;
}

function parseBaseURL(input: string | URL): URL {
	let url: URL;

	try {
		url = new URL(input);
	} catch {
		throw new ProtocolError("Invalid client base URL");
	}

	if (url.protocol !== "http:" && url.protocol !== "https:") {
		throw new ProtocolError("Invalid client base URL");
	}

	return url;
}

function resolveURL(method: HTTPMethod, path: string, href: string, base: URL | undefined): string {
	if (base === undefined) {
		return href;
	}

	const url = new URL(href, base);

	if (url.origin !== base.origin) {
		invalidRequest(method, path, "Client URL escaped its configured origin");
	}

	return url.href;
}

function serializeNative(method: HTTPMethod, path: string, options: RuntimeRequestOptions): string {
	const template = parseTemplate(method, path);
	const params = inputRecord(method, path, options.params, template.parameterNames);
	const segments = template.segments.map((segment) => {
		const match = PARAMETER_SEGMENT_PATTERN.exec(segment);

		if (match === null) {
			return segment;
		}

		return encodeScalar(method, path, dataProperty(method, path, params, match[1]!));
	});
	const searchParams = new URLSearchParams();
	const search = inputRecord(method, path, options.search);

	for (const name of Object.keys(search)) {
		const value = dataProperty(method, path, search, name);

		if (value === undefined) {
			continue;
		}

		if (Array.isArray(value)) {
			assertScalarArray(method, path, value);

			for (const item of value) {
				searchParams.append(name, scalar(method, path, item));
			}

			continue;
		}

		searchParams.append(name, scalar(method, path, value));
	}

	const pathname = canonicalPath(method, path, segments.join("/"));

	return searchParams.size === 0 ? pathname : `${pathname}?${searchParams}`;
}

function serializeHref(method: HTTPMethod, path: string, options: RuntimeRequestOptions): string {
	if (Object.hasOwn(options, "params") || Object.hasOwn(options, "search")) {
		invalidRequest(method, path, "Prebuilt client URLs cannot include generic route input");
	}

	const href = dataProperty(method, path, options, "href");

	if (typeof href !== "string" || !href.startsWith("/") || href.startsWith("//") || href.includes("\\")) {
		invalidRequest(method, path, "Invalid prebuilt client URL");
	}

	let url: URL;

	try {
		url = new URL(href, CLIENT_BASE_URL);
	} catch {
		invalidRequest(method, path, "Invalid prebuilt client URL");
	}

	if (url.origin !== CLIENT_BASE_URL.slice(0, -1) || url.hash !== "") {
		invalidRequest(method, path, "Invalid prebuilt client URL");
	}

	const template = parseTemplate(method, path);
	const templatePathname = canonicalPath(method, path, template.segments.join("/"));
	const expectedSegments = templatePathname.split("/");
	const actualSegments = url.pathname.split("/");

	if (
		expectedSegments.length !== actualSegments.length ||
		expectedSegments.some((segment, index) => {
			return PARAMETER_SEGMENT_PATTERN.test(segment)
				? actualSegments[index] === ""
				: segment !== actualSegments[index];
		})
	) {
		invalidRequest(method, path, "Prebuilt client URL does not match its route template");
	}

	return `${url.pathname}${url.search}`;
}

function parseTemplate(
	method: HTTPMethod,
	path: string,
): { readonly parameterNames: string[]; readonly segments: string[] } {
	if (typeof path !== "string" || !path.startsWith("/") || path.startsWith("//") || path.includes("\\")) {
		invalidRequest(method, String(path), "Invalid client route template");
	}

	const segments = path.split("/");
	const parameterNames: string[] = [];

	for (const segment of segments) {
		const match = PARAMETER_SEGMENT_PATTERN.exec(segment);

		if (match !== null) {
			if (parameterNames.includes(match[1]!)) {
				invalidRequest(method, path, "Invalid client route template");
			}

			parameterNames.push(match[1]!);
		} else if (INVALID_LITERAL_PATTERN.test(segment)) {
			invalidRequest(method, path, "Invalid client route template");
		}
	}

	return { parameterNames, segments };
}

function canonicalPath(method: HTTPMethod, path: string, pathname: string): string {
	try {
		return new URL(pathname, CLIENT_BASE_URL).pathname;
	} catch {
		return invalidRequest(method, path, "Invalid client URL");
	}
}

function inputRecord(
	method: HTTPMethod,
	path: string,
	input: unknown,
	expectedKeys?: readonly string[],
): Record<string, unknown> {
	if (input === undefined) {
		if (expectedKeys?.length) {
			invalidRequest(method, path, "Missing client route input");
		}

		return {};
	}

	if (typeof input !== "object" || input === null || Array.isArray(input)) {
		invalidRequest(method, path, "Invalid client route input");
	}

	const prototype = Object.getPrototypeOf(input);
	const keys = Object.keys(input);

	if (
		(prototype !== Object.prototype && prototype !== null) ||
		(expectedKeys !== undefined &&
			(keys.length !== expectedKeys.length || keys.some((key) => !expectedKeys.includes(key))))
	) {
		invalidRequest(method, path, "Invalid client route input");
	}

	return input as Record<string, unknown>;
}

function requestOptions(method: HTTPMethod, path: string, input: unknown): RuntimeRequestOptions {
	const value = inputRecord(method, path, input);
	const keys = ["body", "credentials", "headers", "href", "params", "search", "signal"];

	if (Object.keys(value).some((key) => !keys.includes(key))) {
		invalidRequest(method, path, "Invalid client request options");
	}

	for (const key of Object.keys(value)) {
		dataProperty(method, path, value, key);
	}

	return value;
}

function dataProperty(method: HTTPMethod, path: string, value: object, name: string): unknown {
	const descriptor = Object.getOwnPropertyDescriptor(value, name);

	if (descriptor === undefined || !("value" in descriptor)) {
		invalidRequest(method, path, "Invalid client route input");
	}

	return descriptor.value;
}

function scalar(method: HTTPMethod, path: string, value: unknown): string {
	if (typeof value === "string") {
		return value;
	}

	if (typeof value === "number" && Number.isSafeInteger(value)) {
		return String(value);
	}

	return invalidRequest(method, path, "Invalid native route value");
}

function encodeScalar(method: HTTPMethod, path: string, value: unknown): string {
	const string = scalar(method, path, value);

	if (string === "" || string === "." || string === "..") {
		invalidRequest(method, path, "Invalid native pathname value");
	}

	try {
		return encodeURIComponent(string);
	} catch {
		return invalidRequest(method, path, "Invalid native pathname value");
	}
}

function assertScalarArray(method: HTTPMethod, path: string, value: unknown[]): void {
	if (Object.keys(value).length !== value.length) {
		invalidRequest(method, path, "Invalid native route value");
	}

	for (let index = 0; index < value.length; ++index) {
		dataProperty(method, path, value, String(index));
		scalar(method, path, value[index]);
	}
}

function invalidRequest(method: HTTPMethod, path: string, message: string): never {
	throw new ProtocolError(message, { method, path });
}
