import "@serve-tools/polyfill-urlpattern";
import type { Schema } from "@serve-tools/http-contract";
import { defineAPI } from "@serve-tools/http-contract";
import { createHandler } from "@serve-tools/http-contract/server";
import { codec, route } from "@serve-tools/router";

/** Wraps one application validator in the vendor-neutral Standard Schema interface. */
export const standardSchema = <Input, Output>(validate: (value: Input) => Output): Schema<Input, Output> => ({
	"~standard": {
		version: 1,
		vendor: "consumer-recipe",
		validate(value) {
			try {
				return { value: validate(value as Input) };
			} catch (error) {
				return {
					issues: [
						{
							message: error instanceof Error ? error.message : "Validation failed",
						},
					],
				};
			}
		},
	},
});

/** Narrows an unknown value to a safe integer while keeping negative zero invalid. */
export const safeInteger = (value: unknown): number => {
	if (!Number.isSafeInteger(value) || Object.is(value, -0)) {
		throw new TypeError("Expected a safe integer other than negative zero");
	}

	return value as number;
};

const recordResponse = standardSchema<unknown, { readonly id: number; readonly label: string }>((value) => {
	if (typeof value !== "object" || value === null || Array.isArray(value)) {
		throw new TypeError("Expected a record response");
	}

	const input = value as Record<string, unknown>;

	if (typeof input.label !== "string") {
		throw new TypeError("Expected a string label");
	}

	return { id: safeInteger(input.id), label: input.label };
});

const missingResponse = standardSchema<unknown, { readonly error: "not_found" }>((value) => {
	if (
		typeof value !== "object" ||
		value === null ||
		Array.isArray(value) ||
		(value as Record<string, unknown>).error !== "not_found"
	) {
		throw new TypeError("Expected a not-found response");
	}

	return { error: "not_found" };
});

/** Replace this path and its search declaration while keeping the same route object in the contract. */
export const recordRoute = route("/records/:id", {
	params: { id: codec.integer() },
	search: { view: codec.enum("compact", "expanded").default("compact") },
});

/** A small status-discriminated JSON contract with an explicit bodyless response. */
export const recordsAPI = defineAPI({
	routes: {
		[recordRoute.path]: {
			route: recordRoute,
			GET: { responses: { 200: recordResponse, 404: missingResponse } },
			DELETE: { responses: { 204: null, 404: missingResponse } },
		},
	},
});

/** Compiles an in-memory native Fetch handler; replace the Map operations at the application boundary. */
export const createRecordsHandler = (records: Map<number, string>) =>
	createHandler(recordsAPI, {
		handlers: {
			"GET /records/:id": ({ params }) => {
				const label = records.get(params.id);

				return label === undefined
					? { status: 404, body: { error: "not_found" } }
					: { status: 200, body: { id: params.id, label } };
			},
			"DELETE /records/:id": ({ params }) =>
				records.delete(params.id) ? { status: 204 } : { status: 404, body: { error: "not_found" } },
		},
	});

// Add your task adapter below.
