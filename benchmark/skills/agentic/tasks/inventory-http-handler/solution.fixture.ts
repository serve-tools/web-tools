import { defineAPI } from "@serve-tools/http-contract";
import { createHandler } from "@serve-tools/http-contract/server";
import { codec, route } from "@serve-tools/router";

interface Item {
	readonly id: number;
	readonly name: string;
	readonly quantity: number;
}

interface Schema<T> {
	"~standard": {
		version: 1;
		vendor: string;
		types?: { input: T; output: T };
		validate(value: unknown): { value: T; issues?: undefined } | { issues: { message: string }[] };
	};
}

const itemSchema = schema<Item>((value) => {
	if (!isRecord(value) || Object.keys(value).length !== 3) {
		return undefined;
	}
	if (typeof value.id !== "number" || !Number.isSafeInteger(value.id) || value.id <= 0) {
		return undefined;
	}
	if (typeof value.name !== "string") {
		return undefined;
	}
	if (typeof value.quantity !== "number" || !Number.isSafeInteger(value.quantity) || value.quantity < 0) {
		return undefined;
	}

	return { id: value.id, name: value.name, quantity: value.quantity };
});
const updateSchema = schema<Omit<Item, "id">>((value) => {
	if (!isRecord(value) || Object.keys(value).length !== 2) {
		return undefined;
	}
	if (typeof value.name !== "string") {
		return undefined;
	}
	if (typeof value.quantity !== "number" || !Number.isSafeInteger(value.quantity) || value.quantity < 0) {
		return undefined;
	}

	return { name: value.name, quantity: value.quantity };
});
const missingSchema = schema<{ readonly error: "not_found" }>((value) =>
	isRecord(value) && Object.keys(value).length === 1 && value.error === "not_found"
		? { error: "not_found" }
		: undefined,
);
const invalidSchema = schema<{ readonly error: "invalid_request" }>((value) =>
	isRecord(value) && Object.keys(value).length === 1 && value.error === "invalid_request"
		? { error: "invalid_request" }
		: undefined,
);

const itemRoute = route("/items/:itemId", { params: { itemId: codec.integer() } });
const api = defineAPI({
	responses: { 400: invalidSchema },
	routes: {
		[itemRoute.path]: {
			route: itemRoute,
			GET: { responses: { 200: itemSchema, 404: missingSchema } },
			PUT: { body: updateSchema, responses: { 204: null } },
		},
	},
});

export function createInventoryHandler(initial: Iterable<Item> = []) {
	const items = new Map<number, Item>();

	for (const value of initial) {
		const item = validate(itemSchema, value);
		items.set(item.id, item);
	}

	return createHandler(api, {
		maxBodyBytes: 256,
		context: ({ params, respond }) =>
			params.itemId > 0 ? undefined : respond({ status: 400, body: { error: "invalid_request" } }),
		handlers: {
			"GET /items/:itemId": ({ params }) => {
				const item = items.get(params.itemId);

				return item ? { status: 200, body: { ...item } } : { status: 404, body: { error: "not_found" } };
			},
			"PUT /items/:itemId": ({ params, body }) => {
				items.set(params.itemId, { id: params.itemId, ...body });

				return { status: 204 };
			},
		},
	});
}

function schema<T>(parse: (value: unknown) => T | undefined): Schema<T> {
	return {
		"~standard": {
			version: 1 as const,
			vendor: "agentic-fixture",
			validate(value: unknown) {
				const parsed = parse(value);

				return parsed === undefined ? { issues: [{ message: "Invalid value" }] } : { value: parsed };
			},
		},
	};
}

function validate<T>(selected: Schema<T>, value: unknown): T {
	const result = selected["~standard"].validate(value);

	if (result instanceof Promise) {
		throw new TypeError("Unexpected asynchronous schema");
	}
	if (result.issues) {
		throw new TypeError("Invalid initial item");
	}

	return result.value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}
