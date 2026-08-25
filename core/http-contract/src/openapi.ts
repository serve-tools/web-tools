import type { StandardJSONSchemaV1 } from "@standard-schema/spec";
import type { API, HTTPMethod, Schema } from "./http-contract.js";
import { httpMethods } from "./http-contract.js";

type JSONSchema = Readonly<Record<string, unknown>>;
type JSONSchemaConverter = StandardJSONSchemaV1["~standard"]["jsonSchema"];

const responseDescriptions: Readonly<Record<number, string>> = {
	400: "Invalid request",
	401: "Unauthorized",
	403: "Forbidden",
	404: "Not found",
	405: "Method not allowed",
	409: "Conflict",
	413: "Payload too large",
	415: "Unsupported media type",
	429: "Too many requests",
};

/** Options for deriving an OpenAPI document from an HTTP contract. */
export interface OpenAPIOptions {
	readonly info: {
		readonly title: string;
		readonly version: string;
		readonly description?: string;
	};
}

/** A portable OpenAPI 3.1 document derived from an HTTP contract. */
export interface OpenAPIDocument {
	readonly openapi: "3.1.0";
	readonly info: OpenAPIOptions["info"];
	readonly paths: Readonly<Record<string, OpenAPIPathItem>>;
}

/** An OpenAPI path item containing the declared HTTP operations. */
export type OpenAPIPathItem = Partial<Record<Lowercase<HTTPMethod>, OpenAPIOperation>> & {
	readonly parameters?: readonly OpenAPIParameter[];
};

/** An OpenAPI pathname parameter. */
export interface OpenAPIParameter {
	readonly name: string;
	readonly in: "path";
	readonly required: true;
	readonly schema: JSONSchema;
}

/** An OpenAPI operation derived from one HTTP contract operation. */
export interface OpenAPIOperation {
	readonly operationId: string;
	readonly summary?: string;
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
export function toOpenAPI(api: API, { info }: OpenAPIOptions): OpenAPIDocument {
	const paths: Record<string, OpenAPIPathItem> = {};

	for (const [routePath, contract] of Object.entries(api.routes).sort(([left], [right]) =>
		left < right ? -1 : left > right ? 1 : 0,
	)) {
		const parameters: OpenAPIParameter[] = [];
		const path = routePath.replace(/:([A-Za-z_$][\w$]*)/g, (_match, name: string) => {
			parameters.push({ name, in: "path", required: true, schema: { type: "string" } });

			return `{${name}}`;
		});
		const pathItem: Record<string, OpenAPIOperation> = {};

		for (const method of httpMethods) {
			const operation = contract[method];

			if (!operation) {
				continue;
			}

			const operationLabel = `${method} ${routePath} (${operation.operationId})`;
			const responses: Record<string, OpenAPIResponse> = {};

			for (const [status, schema] of Object.entries({ ...api.commonResponses, ...operation.responses })) {
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
				operationId: operation.operationId,
				...(operation.summary === undefined ? {} : { summary: operation.summary }),
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

	return { openapi: "3.1.0", info, paths };
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
	return status >= 200 && status < 300
		? "Successful response"
		: (responseDescriptions[status] ?? `HTTP ${status} response`);
}
