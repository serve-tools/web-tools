import type { StandardJSONSchemaV1 } from "@standard-schema/spec";
import { ProtocolError } from "./error.js";
import type { Schema, SchemaInput } from "./types.js";

const adapterBody = Symbol.for("@serve-tools/http-contract/adapter-response/v1");

/** Adapter-owned failures that can have a custom schema and body producer. */
export type AdapterErrorStatus = 400 | 404 | 405 | 413 | 415;

/** Request metadata supplied when an adapter creates a declared error response. */
export interface AdapterResponseInput {
	readonly request: Request;
	readonly status: AdapterErrorStatus;
}

/** A response schema paired with its adapter-only body producer. */
export type AdapterResponse<Value extends Schema> = Pick<Value, "~standard"> & {
	readonly [adapterBody]: (input: AdapterResponseInput) => SchemaInput<Value> | PromiseLike<SchemaInput<Value>>;
};

/** Pairs an adapter-error schema with the body producer that must satisfy its input. */
export function adapterResponse<const Value extends Schema, const Body extends SchemaInput<Value>>(
	schema: Value,
	createBody: (input: AdapterResponseInput) => Body | PromiseLike<Body>,
): AdapterResponse<Value> {
	if (
		schema?.["~standard"]?.version !== 1 ||
		typeof schema["~standard"].vendor !== "string" ||
		typeof schema["~standard"].validate !== "function"
	) {
		throw new ProtocolError("An adapter response must use a Standard Schema validator.");
	}
	if (typeof createBody !== "function") {
		throw new ProtocolError("An adapter response requires a body producer.");
	}

	return Object.freeze({ "~standard": schema["~standard"], [adapterBody]: createBody });
}

export function adapterResponseBody(schema: Schema | null | undefined, input: AdapterResponseInput): unknown {
	const selected = schema && (schema as Partial<AdapterResponse<Schema>>)[adapterBody];
	if (selected !== undefined && selected !== null && typeof selected !== "function") {
		throw new ProtocolError("An adapter response has an invalid body producer.", { status: input.status });
	}

	return (selected ?? defaultAdapterResponses[input.status][adapterBody])(input);
}

function defaultResponse<const Code extends string>(error: Code) {
	type Body = { readonly error: Code };
	const jsonSchema = () => ({
		type: "object",
		properties: { error: { type: "string", const: error } },
		required: ["error"],
		additionalProperties: false,
	});
	const schema: Schema<Body> & StandardJSONSchemaV1<Body> = {
		"~standard": Object.freeze({
			version: 1,
			vendor: "@serve-tools/http-contract",
			validate(value: unknown) {
				return typeof value === "object" &&
					value !== null &&
					Object.hasOwn(value, "error") &&
					Object.keys(value).length === 1 &&
					(value as Body).error === error
					? { value: { error } }
					: { issues: [{ message: `Expected adapter error ${error}.` }] };
			},
			jsonSchema: Object.freeze({ input: jsonSchema, output: jsonSchema }),
		}),
	};

	return adapterResponse(schema, () => ({ error }));
}

export const defaultAdapterResponses = Object.freeze({
	400: defaultResponse("invalid_request"),
	404: defaultResponse("not_found"),
	405: defaultResponse("method_not_allowed"),
	413: defaultResponse("request_too_large"),
	415: defaultResponse("unsupported_media_type"),
});

export type DefaultAdapterResponses = typeof defaultAdapterResponses;
