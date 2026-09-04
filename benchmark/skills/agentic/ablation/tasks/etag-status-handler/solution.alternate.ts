import type { Schema as StandardSchemaV1 } from "@serve-tools/http-contract";
import { defineAPI } from "@serve-tools/http-contract";
import { createHandler } from "@serve-tools/http-contract/server";
import { codec, route } from "@serve-tools/router";

type Service = "api" | "worker";
type Status = "up" | "down";
type Item = { service: Service; status: Status; revision: number };

const statusRoute = route("/statuses/:service", { params: { service: codec.enum("api", "worker") } });
const itemSchema = schema<Item>(
	(value): value is Item =>
		exact(value, ["service", "status", "revision"]) &&
		(value.service === "api" || value.service === "worker") &&
		(value.status === "up" || value.status === "down") &&
		positive(value.revision),
);
const updateSchema = schema<{ status: Status; revision: number }>(
	(value): value is { status: Status; revision: number } =>
		exact(value, ["status", "revision"]) &&
		(value.status === "up" || value.status === "down") &&
		positive(value.revision),
);
const missingSchema = schema<{ error: "not_found" }>(
	(value): value is { error: "not_found" } => exact(value, ["error"]) && value.error === "not_found",
);
const staleSchema = schema<{ error: "stale_revision"; revision: number }>(
	(value): value is { error: "stale_revision"; revision: number } =>
		exact(value, ["error", "revision"]) && value.error === "stale_revision" && positive(value.revision),
);
const api = defineAPI({
	routes: {
		[statusRoute.path]: {
			route: statusRoute,
			GET: { responses: { 200: itemSchema, 404: missingSchema } },
			PUT: { body: updateSchema, responses: { 200: itemSchema, 409: staleSchema } },
		},
	},
});

export function createStatusHandler(initial: Iterable<Item> = []): (request: Request) => Promise<Response> {
	const items = new Map<Service, Item>();
	for (const item of checkedInitial(initial)) {
		items.set(item.service, { ...item });
	}
	return createHandler(api, {
		maxBodyBytes: 64,
		handlers: {
			"GET /statuses/:service": ({ params }) => {
				const item = items.get(params.service);
				return item ? { status: 200, body: { ...item } } : { status: 404, body: { error: "not_found" } };
			},
			"PUT /statuses/:service": ({ params, body }) => {
				const current = items.get(params.service);
				if (current && body.revision <= current.revision) {
					return { status: 409, body: { error: "stale_revision", revision: current.revision } };
				}
				const item = { service: params.service, status: body.status, revision: body.revision };
				items.set(item.service, item);
				return { status: 200, body: { ...item } };
			},
		},
	});
}

function checkedInitial(value: Iterable<Item>): Item[] {
	if (value === null || value === undefined || typeof value[Symbol.iterator] !== "function") {
		throw new TypeError("Expected initial items");
	}
	if (Array.isArray(value) && Object.keys(value).length !== value.length) {
		throw new TypeError("Expected dense initial items");
	}
	const output = Array.from(value);
	if (
		!output.every(
			(item) =>
				exact(item, ["service", "status", "revision"]) &&
				(item.service === "api" || item.service === "worker") &&
				(item.status === "up" || item.status === "down") &&
				positive(item.revision),
		)
	) {
		throw new TypeError("Invalid initial item");
	}
	return output;
}

function schema<T>(check: (value: unknown) => value is T): StandardSchemaV1<T> {
	return {
		"~standard": {
			version: 1,
			vendor: "alternate",
			validate: (value: unknown) => (check(value) ? { value } : { issues: [{ message: "Invalid value" }] }),
		},
	};
}

function exact(value: unknown, keys: readonly string[]): value is Record<string, unknown> {
	return (
		typeof value === "object" &&
		value !== null &&
		!Array.isArray(value) &&
		Object.keys(value).length === keys.length &&
		keys.every((key) => Object.hasOwn(value, key))
	);
}

function positive(value: unknown): value is number {
	return Number.isSafeInteger(value) && (value as number) > 0;
}
