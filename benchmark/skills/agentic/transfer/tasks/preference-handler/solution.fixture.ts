import { defineAPI } from "@serve-tools/http-contract";
import { createHandler } from "@serve-tools/http-contract/server";
import { codec, route } from "@serve-tools/router";

type PreferenceKey = "theme" | "nickname";
type PreferenceValue = string | null;

interface InitialPreference {
	readonly userId: number;
	readonly key: PreferenceKey;
	readonly value: PreferenceValue;
}

interface Schema<T> {
	"~standard": {
		version: 1;
		vendor: string;
		types?: { input: T; output: T };
		validate(value: unknown): { value: T; issues?: undefined } | { issues: { message: string }[] };
	};
}

const preferenceSchema = schema<{ readonly key: PreferenceKey; readonly value: PreferenceValue }>((value) => {
	if (!isRecord(value) || Object.keys(value).length !== 2 || !isKey(value.key) || !isValue(value.value)) {
		return undefined;
	}

	return { key: value.key, value: value.value };
});
const patchSchema = schema<{ readonly value: PreferenceValue }>((value) => {
	if (
		!isRecord(value) ||
		Object.keys(value).length !== 1 ||
		!Object.hasOwn(value, "value") ||
		!isValue(value.value)
	) {
		return undefined;
	}

	return { value: value.value };
});
const missingSchema = errorSchema("not_found");
const invalidSchema = errorSchema("invalid_request");

const preferenceRoute = route("/users/:userId/preferences/:key", {
	params: { userId: codec.integer(), key: codec.enum("theme", "nickname") },
});
const api = defineAPI({
	responses: { 400: invalidSchema },
	routes: {
		[preferenceRoute.path]: {
			route: preferenceRoute,
			GET: { responses: { 200: preferenceSchema, 404: missingSchema } },
			PATCH: { body: patchSchema, responses: { 200: preferenceSchema } },
			DELETE: { responses: { 204: null, 404: missingSchema } },
		},
	},
});

export function createPreferenceHandler(initial: Iterable<InitialPreference> = []) {
	const preferences = new Map<string, PreferenceValue>();

	if (initial == null || typeof initial[Symbol.iterator] !== "function") {
		throw new TypeError("Expected iterable preferences");
	}
	for (const record of initial) {
		validateInitial(record);
		preferences.set(storageKey(record.userId, record.key), record.value);
	}

	return createHandler(api, {
		maxBodyBytes: 128,
		context: ({ params, respond }) =>
			params.userId > 0 ? undefined : respond({ status: 400, body: { error: "invalid_request" } }),
		handlers: {
			"GET /users/:userId/preferences/:key": ({ params }) => {
				const id = storageKey(params.userId, params.key);

				return preferences.has(id)
					? { status: 200, body: { key: params.key, value: preferences.get(id) as PreferenceValue } }
					: { status: 404, body: { error: "not_found" } };
			},
			"PATCH /users/:userId/preferences/:key": ({ params, body }) => {
				preferences.set(storageKey(params.userId, params.key), body.value);

				return { status: 200, body: { key: params.key, value: body.value } };
			},
			"DELETE /users/:userId/preferences/:key": ({ params }) =>
				preferences.delete(storageKey(params.userId, params.key))
					? { status: 204 }
					: { status: 404, body: { error: "not_found" } },
		},
	});
}

function storageKey(userId: number, key: PreferenceKey): string {
	return `${userId}\u0000${key}`;
}

function validateInitial(value: unknown): asserts value is InitialPreference {
	if (
		!isRecord(value) ||
		Object.keys(value).length !== 3 ||
		!Number.isSafeInteger(value.userId) ||
		(value.userId as number) <= 0 ||
		!isKey(value.key) ||
		!isValue(value.value)
	) {
		throw new TypeError("Invalid initial preference");
	}
}

function schema<T>(parse: (value: unknown) => T | undefined): Schema<T> {
	return {
		"~standard": {
			version: 1 as const,
			vendor: "transfer-fixture",
			validate(value) {
				const parsed = parse(value);

				return parsed === undefined ? { issues: [{ message: "Invalid value" }] } : { value: parsed };
			},
		},
	};
}

function errorSchema<const ErrorName extends string>(error: ErrorName) {
	return schema<{ readonly error: ErrorName }>((value) =>
		isRecord(value) && Object.keys(value).length === 1 && value.error === error ? { error } : undefined,
	);
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isKey(value: unknown): value is PreferenceKey {
	return value === "theme" || value === "nickname";
}

function isValue(value: unknown): value is PreferenceValue {
	return value === null || typeof value === "string";
}
