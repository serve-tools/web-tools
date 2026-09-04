import { defineAPI } from "@serve-tools/http-contract";
import { createHandler } from "@serve-tools/http-contract/server";
import { codec, route } from "@serve-tools/router";

type Status = "up" | "down";
type Item = { service: "api" | "worker"; status: Status; revision: number };
type Schema<T> = {
	"~standard": {
		version: 1;
		vendor: string;
		validate(value: unknown): { value: T } | { issues: Array<{ message: string }> };
	};
};
const schema = <T>(parse: (value: unknown) => T | undefined): Schema<T> => ({
	"~standard": {
		version: 1,
		vendor: "fixture",
		validate(value) {
			const parsed = parse(value);
			return parsed === undefined ? { issues: [{ message: "invalid" }] } : { value: parsed };
		},
	},
});
const record = (value: unknown): value is Record<string, unknown> =>
	typeof value === "object" && value !== null && !Array.isArray(value);
const item = schema<Item>((value) =>
	record(value) &&
	Object.keys(value).length === 3 &&
	(value.service === "api" || value.service === "worker") &&
	(value.status === "up" || value.status === "down") &&
	Number.isSafeInteger(value.revision) &&
	Number(value.revision) > 0
		? (value as Item)
		: undefined,
);
const update = schema<Omit<Item, "service">>((value) =>
	record(value) &&
	Object.keys(value).length === 2 &&
	(value.status === "up" || value.status === "down") &&
	Number.isSafeInteger(value.revision) &&
	Number(value.revision) > 0
		? (value as Omit<Item, "service">)
		: undefined,
);
const missing = schema<{ error: "not_found" }>((value) =>
	record(value) && value.error === "not_found" ? { error: "not_found" } : undefined,
);
const stale = schema<{ error: "stale_revision"; revision: number }>((value) =>
	record(value) && value.error === "stale_revision" && typeof value.revision === "number"
		? (value as { error: "stale_revision"; revision: number })
		: undefined,
);
const statusRoute = route("/statuses/:service", { params: { service: codec.enum("api", "worker") } });
const api = defineAPI({
	routes: {
		[statusRoute.path]: {
			route: statusRoute,
			GET: { responses: { 200: item, 404: missing } },
			PUT: { body: update, responses: { 200: item, 409: stale } },
		},
	},
});
export function createStatusHandler(initial: Iterable<Item> = []) {
	const statuses = new Map<Item["service"], Item>();
	for (const entry of initial) {
		const valid = item["~standard"].validate(entry);
		if ("issues" in valid) {
			throw new TypeError("initial");
		}
		statuses.set(valid.value.service, { ...valid.value });
	}
	return createHandler(api, {
		maxBodyBytes: 64,
		handlers: {
			"GET /statuses/:service": ({ params }) => {
				const value = statuses.get(params.service as Item["service"]);
				return value ? { status: 200, body: { ...value } } : { status: 404, body: { error: "not_found" } };
			},
			"PUT /statuses/:service": ({ params, body }) => {
				const input = body as Omit<Item, "service">;
				const service = params.service as Item["service"];
				const current = statuses.get(service);
				if (current && input.revision <= current.revision) {
					return { status: 409, body: { error: "stale_revision", revision: current.revision } };
				}
				const value: Item = { service, ...input };
				statuses.set(service, value);
				return { status: 200, body: value };
			},
		},
	});
}
