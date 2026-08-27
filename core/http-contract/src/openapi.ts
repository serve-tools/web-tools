import type { StandardJSONSchemaV1 } from "@standard-schema/spec";
import type { API, HTTPMethod, Schema } from "./http-contract.js";
import { httpMethods } from "./http-contract.js";

type JSONSchema = Readonly<Record<string, unknown>>;
type JSONSchemaConverter = StandardJSONSchemaV1["~standard"]["jsonSchema"];
type SecurityRequirement = readonly Readonly<Record<string, readonly string[]>>[];
type ParameterCodec = {
	readonly metadata?: {
		readonly type?: "string" | "integer" | "enum" | "custom";
		readonly required?: boolean;
		readonly repeated?: boolean;
		readonly values?: readonly string[];
		readonly defaultValue?: unknown;
	};
	readonly required?: boolean;
	readonly multiple?: boolean;
};

const responseDescriptions: Readonly<Record<number, string>> = {
	200: "OK",
	201: "Created",
	202: "Accepted",
	203: "Non-Authoritative Information",
	204: "No Content",
	205: "Reset Content",
	206: "Partial Content",
	207: "Multi-Status",
	208: "Already Reported",
	226: "IM Used",
	400: "Bad Request",
	401: "Unauthorized",
	402: "Payment Required",
	403: "Forbidden",
	404: "Not Found",
	405: "Method Not Allowed",
	406: "Not Acceptable",
	407: "Proxy Authentication Required",
	408: "Request Timeout",
	409: "Conflict",
	410: "Gone",
	411: "Length Required",
	412: "Precondition Failed",
	413: "Content Too Large",
	414: "URI Too Long",
	415: "Unsupported Media Type",
	416: "Range Not Satisfiable",
	417: "Expectation Failed",
	418: "I'm a teapot",
	421: "Misdirected Request",
	422: "Unprocessable Content",
	423: "Locked",
	424: "Failed Dependency",
	425: "Too Early",
	426: "Upgrade Required",
	428: "Precondition Required",
	429: "Too Many Requests",
	431: "Request Header Fields Too Large",
	451: "Unavailable For Legal Reasons",
	500: "Internal Server Error",
	501: "Not Implemented",
	502: "Bad Gateway",
	503: "Service Unavailable",
	504: "Gateway Timeout",
	505: "HTTP Version Not Supported",
	506: "Variant Also Negotiates",
	507: "Insufficient Storage",
	508: "Loop Detected",
	510: "Not Extended",
	511: "Network Authentication Required",
};

/** Options for deriving an OpenAPI document from an HTTP contract. */
export interface OpenAPIOptions {
	readonly info: {
		readonly title: string;
		readonly version: string;
		readonly description?: string;
	};
	readonly servers?: readonly OpenAPIServer[];
	readonly tags?: readonly OpenAPITag[];
	readonly securitySchemes?: Readonly<Record<string, OpenAPISecurityScheme>>;
	readonly security?: SecurityRequirement;
}

/** One server through which an API can be reached. */
export interface OpenAPIServer {
	readonly url: string;
	readonly description?: string;
}

/** Documentation for one operation tag. */
export interface OpenAPITag {
	readonly name: string;
	readonly description?: string;
}

/** An API-key security scheme. */
export interface OpenAPIAPIKeySecurityScheme {
	readonly type: "apiKey";
	readonly name: string;
	readonly in: "cookie" | "header" | "query";
	readonly description?: string;
}

/** An HTTP authentication security scheme. */
export interface OpenAPIHTTPSecurityScheme {
	readonly type: "http";
	readonly scheme: string;
	readonly bearerFormat?: string;
	readonly description?: string;
}

/** A mutual TLS security scheme. */
export interface OpenAPIMutualTLSSecurityScheme {
	readonly type: "mutualTLS";
	readonly description?: string;
}

/** Shared OAuth flow metadata. */
export interface OpenAPIOAuthFlow {
	readonly refreshUrl?: string;
	readonly scopes: Readonly<Record<string, string>>;
}

/** OAuth implicit-flow metadata. */
export interface OpenAPIImplicitOAuthFlow extends OpenAPIOAuthFlow {
	readonly authorizationUrl: string;
}

/** OAuth password-flow metadata. */
export interface OpenAPIPasswordOAuthFlow extends OpenAPIOAuthFlow {
	readonly tokenUrl: string;
}

/** OAuth client-credentials-flow metadata. */
export interface OpenAPIClientCredentialsOAuthFlow extends OpenAPIOAuthFlow {
	readonly tokenUrl: string;
}

/** OAuth authorization-code-flow metadata. */
export interface OpenAPIAuthorizationCodeOAuthFlow extends OpenAPIOAuthFlow {
	readonly authorizationUrl: string;
	readonly tokenUrl: string;
}

/** OAuth flow metadata used by an OAuth 2 security scheme. */
export type OpenAPIOAuthFlows = Partial<{
	readonly implicit: OpenAPIImplicitOAuthFlow;
	readonly password: OpenAPIPasswordOAuthFlow;
	readonly clientCredentials: OpenAPIClientCredentialsOAuthFlow;
	readonly authorizationCode: OpenAPIAuthorizationCodeOAuthFlow;
}> &
	(
		| { readonly implicit: OpenAPIImplicitOAuthFlow }
		| { readonly password: OpenAPIPasswordOAuthFlow }
		| { readonly clientCredentials: OpenAPIClientCredentialsOAuthFlow }
		| { readonly authorizationCode: OpenAPIAuthorizationCodeOAuthFlow }
	);

/** An OAuth 2 security scheme. */
export interface OpenAPIOAuthSecurityScheme {
	readonly type: "oauth2";
	readonly flows: OpenAPIOAuthFlows;
	readonly description?: string;
}

/** An OpenID Connect security scheme. */
export interface OpenAPIOpenIDConnectSecurityScheme {
	readonly type: "openIdConnect";
	readonly openIdConnectUrl: string;
	readonly description?: string;
}

/** A security scheme documented by this OpenAPI projection. */
export type OpenAPISecurityScheme =
	| OpenAPIAPIKeySecurityScheme
	| OpenAPIHTTPSecurityScheme
	| OpenAPIMutualTLSSecurityScheme
	| OpenAPIOAuthSecurityScheme
	| OpenAPIOpenIDConnectSecurityScheme;

/** Security alternatives for one operation or the entire API. */
export type OpenAPISecurityRequirement = SecurityRequirement;

/** A portable OpenAPI 3.1 document derived from an HTTP contract. */
export interface OpenAPIDocument {
	readonly openapi: "3.1.0";
	readonly info: OpenAPIOptions["info"];
	readonly servers?: readonly OpenAPIServer[];
	readonly tags?: readonly OpenAPITag[];
	readonly security?: OpenAPISecurityRequirement;
	readonly components?: {
		readonly securitySchemes: Readonly<Record<string, OpenAPISecurityScheme>>;
	};
	readonly paths: Readonly<Record<string, OpenAPIPathItem>>;
}

/** An OpenAPI path item containing the declared HTTP operations. */
export type OpenAPIPathItem = Partial<Record<Lowercase<HTTPMethod>, OpenAPIOperation>> & {
	readonly parameters?: readonly OpenAPIParameter[];
};

/** An OpenAPI pathname parameter. */
export interface OpenAPIParameter {
	readonly name: string;
	readonly in: "path" | "query";
	readonly required: boolean;
	readonly schema: JSONSchema;
}

/** An OpenAPI operation derived from one HTTP contract operation. */
export interface OpenAPIOperation {
	readonly operationId?: string;
	readonly summary?: string;
	readonly description?: string;
	readonly tags?: readonly string[];
	readonly deprecated?: boolean;
	readonly security?: OpenAPISecurityRequirement;
	readonly parameters?: readonly OpenAPIParameter[];
	readonly requestBody?: {
		readonly required: true;
		readonly content: {
			readonly "application/json": {
				readonly schema: JSONSchema;
			};
		};
	};
	readonly responses: Readonly<Record<string, OpenAPIResponse>>;
}

/** An OpenAPI response derived from a declared contract status. */
export interface OpenAPIResponse {
	readonly description: string;
	readonly content?: {
		readonly "application/json": {
			readonly schema: JSONSchema;
		};
	};
}

/**
 * Derives a deterministic OpenAPI 3.1 document from an executable HTTP contract.
 * This opt-in projection requires Standard JSON Schema conversion only for schemas it visits.
 */
export function toOpenAPI(api: API, options: OpenAPIOptions): OpenAPIDocument {
	const { info, security, securitySchemes, servers, tags } = options;

	validateDocumentation(tags, securitySchemes, security);
	const paths: Record<string, OpenAPIPathItem> = {};
	const routeShapes = new Map<string, string>();

	for (const [routePath, contract] of Object.entries(api.routes).sort(([left], [right]) =>
		left < right ? -1 : left > right ? 1 : 0,
	)) {
		const routeShape = routePath.replace(/:[A-Za-z_$][\w$]*/g, "{}");
		const previousPath = routeShapes.get(routeShape);

		if (previousPath !== undefined && previousPath !== routePath) {
			throw new TypeError(
				`OpenAPI route paths collide after parameter templating: ${previousPath} and ${routePath}.`,
			);
		}

		routeShapes.set(routeShape, routePath);
		const parameters: OpenAPIParameter[] = [];
		const path = routePath.replace(/:([A-Za-z_$][\w$]*)/g, (_match, name: string) => {
			const codec = contract.route.options.params?.[name];
			parameters.push({ name, in: "path", required: true, schema: parameterSchema(codec) });

			return `{${name}}`;
		});
		const pathItem: Record<string, OpenAPIOperation> = {};

		for (const method of httpMethods) {
			const operation = contract[method];

			if (!operation) {
				continue;
			}

			const operationLabel =
				operation.operationId === undefined
					? `${method} ${routePath}`
					: `${method} ${routePath} (${operation.operationId})`;

			validateSecurityRequirement(operation.security, securitySchemes, operationLabel);
			const queryParameters = (Object.entries(contract.route.options.search ?? {}) as [string, ParameterCodec][])
				.sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
				.map(([name, codec]) => ({
					name,
					in: "query" as const,
					required: codec.metadata?.required ?? codec.required !== false,
					schema: parameterSchema(codec),
				}));
			const responses: Record<string, OpenAPIResponse> = {};

			for (const [status, schema] of Object.entries({ ...api.responses, ...operation.responses })) {
				responses[status] =
					schema === null
						? { description: responseDescription(Number(status)) }
						: {
								description: responseDescription(Number(status)),
								content: {
									"application/json": {
										schema: jsonSchema(schema, "output", `${operationLabel} response ${status}`),
									},
								},
							};
			}

			pathItem[method.toLowerCase()] = {
				...(operation.operationId === undefined ? {} : { operationId: operation.operationId }),
				...(operation.summary === undefined ? {} : { summary: operation.summary }),
				...(operation.description === undefined ? {} : { description: operation.description }),
				...(operation.tags === undefined ? {} : { tags: operation.tags }),
				...(operation.deprecated === undefined ? {} : { deprecated: operation.deprecated }),
				...(operation.security === undefined ? {} : { security: operation.security }),
				...(queryParameters.length === 0 ? {} : { parameters: queryParameters }),
				...(operation.body === undefined
					? {}
					: {
							requestBody: {
								required: true,
								content: {
									"application/json": {
										schema: jsonSchema(operation.body, "input", `${operationLabel} request body`),
									},
								},
							},
						}),
				responses,
			};
		}

		paths[path] = parameters.length === 0 ? pathItem : { ...pathItem, parameters };
	}

	return {
		openapi: "3.1.0",
		info,
		...(servers === undefined ? {} : { servers }),
		...(tags === undefined ? {} : { tags }),
		...(security === undefined ? {} : { security }),
		...(securitySchemes === undefined ? {} : { components: { securitySchemes } }),
		paths,
	};
}

function validateDocumentation(
	tags: readonly OpenAPITag[] | undefined,
	securitySchemes: Readonly<Record<string, OpenAPISecurityScheme>> | undefined,
	security: SecurityRequirement | undefined,
): void {
	if (tags !== undefined) {
		const names = new Set<string>();

		for (const tag of tags) {
			if (names.has(tag.name)) {
				throw new TypeError(`OpenAPI tags must have unique names: ${tag.name}.`);
			}
			names.add(tag.name);
		}
	}

	validateSecurityRequirement(security, securitySchemes, "API");
}

function validateSecurityRequirement(
	security: SecurityRequirement | undefined,
	securitySchemes: Readonly<Record<string, OpenAPISecurityScheme>> | undefined,
	label: string,
): void {
	if (security === undefined) {
		return;
	}

	for (const alternative of security) {
		for (const name of Object.keys(alternative)) {
			if (securitySchemes === undefined || !Object.hasOwn(securitySchemes, name)) {
				throw new TypeError(`${label} OpenAPI security references an undeclared scheme: ${name}.`);
			}
		}
	}
}

function parameterSchema(codec: ParameterCodec | undefined): JSONSchema {
	const metadata = codec?.metadata;
	const defaultValue = metadata?.type === "custom" ? undefined : metadata?.defaultValue;
	const schema: Record<string, unknown> =
		metadata?.type === "integer"
			? { type: "integer", minimum: Number.MIN_SAFE_INTEGER, maximum: Number.MAX_SAFE_INTEGER }
			: metadata?.type === "enum"
				? { type: "string", enum: metadata.values }
				: { type: "string" };

	if (metadata?.repeated ?? codec?.multiple) {
		return defaultValue === undefined
			? { type: "array", items: schema }
			: { type: "array", items: schema, default: defaultValue };
	}

	if (defaultValue !== undefined) {
		schema.default = defaultValue;
	}

	return schema;
}

function jsonSchema(schema: Schema, direction: "input" | "output", label: string): JSONSchema {
	const converter = (schema as unknown as StandardJSONSchemaV1)["~standard"]?.jsonSchema as
		| JSONSchemaConverter
		| undefined;

	if (!converter || typeof converter[direction] !== "function") {
		throw new TypeError(`${label} does not implement Standard JSON Schema conversion.`);
	}

	try {
		return converter[direction]({ target: "draft-2020-12" });
	} catch (error) {
		const message = error instanceof Error ? ` ${error.message}` : "";
		throw new TypeError(`${label} could not convert to Standard JSON Schema.${message}`, { cause: error });
	}
}

function responseDescription(status: number): string {
	return responseDescriptions[status] ?? `HTTP ${status} response`;
}
