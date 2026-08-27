import type { AnyRoute, RouteSearch } from "@serve-tools/router";
import type { ClientRequestOptions, HTTPResult } from "./client.js";
import type {
	API,
	HTTPMethod,
	Operation,
	OperationAt,
	OperationResponses,
	PathsForMethod,
	RouteAt,
	RoutePaths,
	Schema,
	SchemaInput,
} from "./http-contract.js";
import type { ClientFetchOptions } from "./lib/client-runtime.js";
import { fetchJSON, parseClientBaseURL } from "./lib/client-runtime.js";
import { ProtocolError } from "./lib/error.js";
import { httpMethods } from "./lib/types.js";

export type { ClientRequestInit, ClientRequestOptions, HTTPResult } from "./client.js";
export { ProtocolError } from "./lib/error.js";

const STATIC_CLIENT_BASE_URL = "https://http-contract.invalid/";
const STATIC_REQUEST_KEYS = new Set(["body", "init"]);
// biome-ignore lint/suspicious/noControlCharactersInRegex: Static client paths reject URL control characters.
const INVALID_LITERAL_PATTERN = /[:%\\?#{()*\u0000-\u001f\u007f]/;

/** Configuration for a schema-free native Fetch client limited to static route paths. */
export interface StaticClientOptions<InitExtension extends object = object> {
	readonly baseURL?: string | URL;
	readonly fetch?: (
		input: Parameters<typeof globalThis.fetch>[0],
		init?: RequestInit & Partial<InitExtension>,
	) => ReturnType<typeof globalThis.fetch>;
}

type StaticPath<Definition extends API, Path extends RoutePaths<Definition>> =
	RouteAt<Definition, Path> extends {
		readonly route: infer SelectedRoute extends AnyRoute;
		readonly serialization?: "native";
	}
		? Path extends `${string}:${string}`
			? never
			: keyof RouteSearch<SelectedRoute> extends never
				? Path
				: never
		: never;

type StaticPathsForMethod<Definition extends API, Method extends HTTPMethod> = {
	[Path in PathsForMethod<Definition, Method>]: StaticPath<Definition, Path>;
}[PathsForMethod<Definition, Method>];

type StaticClientMethods<Definition extends API> = {
	[Method in HTTPMethod]: StaticPathsForMethod<Definition, Method> extends never ? never : Method;
}[HTTPMethod];

type BodyRequestOptions<Selected extends Operation> = Selected extends { readonly body: infer Body extends Schema }
	? { readonly body: SchemaInput<Body> }
	: { readonly body?: never };

type StaticRequestOptions<
	Selected extends Operation,
	InitExtension extends object,
> = ClientRequestOptions<InitExtension> & BodyRequestOptions<Selected>;
type RequestArguments<Options> = Record<never, never> extends Options ? [options?: Options] : [options: Options];

/** A client restricted to native routes whose pathname and search are both static. */
export type StaticClient<Definition extends API, InitExtension extends object = object> = {
	[Method in StaticClientMethods<Definition>]: <Path extends StaticPathsForMethod<Definition, Method>>(
		path: Path,
		...args: RequestArguments<StaticRequestOptions<OperationAt<Definition, Method, Path>, InitExtension>>
	) => Promise<HTTPResult<OperationResponses<Definition, OperationAt<Definition, Method, Path>>>>;
};

type RuntimeRequestOptions = ClientFetchOptions;

/** Creates the lightweight client for APIs whose browser requests use only static route paths. */
export function createStaticClient<Definition extends API, InitExtension extends object = object>({
	baseURL,
	fetch: fetchImplementation = globalThis.fetch,
}: StaticClientOptions<InitExtension> = {}): StaticClient<Definition, InitExtension> {
	const base = baseURL === undefined ? undefined : parseClientBaseURL(baseURL);
	const client: Partial<Record<HTTPMethod, unknown>> = {};

	for (const method of httpMethods) {
		client[method] = async (path: string, input?: unknown) => {
			const options = requestOptions(method, path, input);
			const href = staticHref(method, path);
			const url = base === undefined ? href : new URL(href, base).href;

			return fetchJSON<InitExtension>(fetchImplementation, method, path, url, options);
		};
	}

	return client as StaticClient<Definition, InitExtension>;
}

function staticHref(method: HTTPMethod, path: string): string {
	if (typeof path !== "string") {
		invalidRequest(method, String(path), "Invalid static client route");
	}

	if (
		path !== "/" &&
		(!path.startsWith("/") ||
			path.startsWith("//") ||
			path
				.slice(1)
				.split("/")
				.some(
					(segment) =>
						segment.length === 0 ||
						segment === "." ||
						segment === ".." ||
						INVALID_LITERAL_PATTERN.test(segment),
				))
	) {
		invalidRequest(method, path, "Invalid static client route");
	}

	return new URL(path, STATIC_CLIENT_BASE_URL).pathname;
}

function requestOptions(method: HTTPMethod, path: string, input: unknown): RuntimeRequestOptions {
	if (input === undefined) {
		return {};
	}

	if (typeof input !== "object" || input === null || Array.isArray(input)) {
		invalidRequest(method, path, "Invalid client request options");
	}

	const prototype = Object.getPrototypeOf(input);
	const keys = Object.keys(input);

	if (
		(prototype !== Object.prototype && prototype !== null) ||
		keys.some((key) => !STATIC_REQUEST_KEYS.has(key) || !("value" in Object.getOwnPropertyDescriptor(input, key)!))
	) {
		invalidRequest(method, path, "Invalid client request options");
	}

	return input as RuntimeRequestOptions;
}

function invalidRequest(method: HTTPMethod, path: string, message: string): never {
	throw new ProtocolError(message, { method, path });
}
