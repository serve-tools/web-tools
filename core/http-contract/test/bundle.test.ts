import { dirname, resolve } from "node:path";
import { gzipSync } from "node:zlib";
import type { Plugin } from "rolldown";
import { rolldown } from "rolldown";
import { describe, expect, it } from "vitest";

const clientSource = new URL("../src/client.ts", import.meta.url).pathname;
const clientRuntimeSource = new URL("../src/lib/client-runtime.ts", import.meta.url).pathname;
const contractSource = new URL("../src/http-contract.ts", import.meta.url).pathname;
const jsonSource = new URL("../src/lib/json.ts", import.meta.url).pathname;
const typesSource = new URL("../src/lib/types.ts", import.meta.url).pathname;
const adapterSource = new URL("../src/lib/adapter.ts", import.meta.url).pathname;
const errorSource = new URL("../src/lib/error.ts", import.meta.url).pathname;
const serverSource = new URL("../src/server.ts", import.meta.url).pathname;
const openAPISource = new URL("../src/openapi.ts", import.meta.url).pathname;
const routerSource = new URL("../../router/src/router.ts", import.meta.url).pathname;
const staticClientSource = new URL("../src/static-client.ts", import.meta.url).pathname;

const applicationContract = "application-contract.ts";
const applicationSchema = "application-schema.ts";
const databaseRuntime = "database-runtime.ts";

describe("client browser bundle isolation", () => {
	it("keeps the static client within production-minified raw and gzip budgets", async () => {
		const { code, modules } = await bundleOutput(`
			import type { applicationAPI } from ${JSON.stringify(applicationContract)};
			import { createStaticClient } from ${JSON.stringify(staticClientSource)};

			const client = createStaticClient<typeof applicationAPI>();

			export const status = async () => (await client.GET("/api/database")).status === 200;
			export const save = (note: string) => client.PUT("/api/database/note", { body: { note } });
		`);

		// Includes native Fetch init forwarding and runtime ownership checks, but no contract metadata.
		expect(Buffer.byteLength(code)).toBeLessThanOrEqual(3_900);
		expect(gzipSync(code).byteLength).toBeLessThanOrEqual(1_650);
		expect(modules).toContain(staticClientSource);
		expect(modules).toContain(clientRuntimeSource);
		expect(modules).not.toContain(clientSource);
		expect(modules).not.toContain(routerSource);
		expect(modules).not.toContain(contractSource);
		expect(modules).not.toContain(adapterSource);
		expect(modules).not.toContain(`\0${applicationContract}`);
		expect(modules).not.toContain(`\0${applicationSchema}`);
		expect(modules).not.toContain(`\0${databaseRuntime}`);
		expect(modules).not.toContain(serverSource);
		expect(modules).not.toContain(openAPISource);
		expect(modules.some((id) => id.includes("@standard-schema") || id.includes("urlpattern"))).toBe(false);
	});

	it("erases the application contract and excludes trusted and router runtimes from native clients", async () => {
		const { code, modules } = await bundleOutput(`
			import type { applicationAPI } from ${JSON.stringify(applicationContract)};
			import { createClient } from ${JSON.stringify(clientSource)};

			const client = createClient<typeof applicationAPI>();

			export const status = async () => (await client.GET("/api/database")).status === 200;
			export const save = (note: string) => client.PUT("/api/database/note", { body: { note } });
		`);

		expect(Buffer.byteLength(code)).toBeLessThanOrEqual(6_250);
		expect(gzipSync(code).byteLength).toBeLessThanOrEqual(2_400);
		expect(modules).toContain(clientSource);
		expect(modules).toContain(clientRuntimeSource);
		expect(modules).toContain(errorSource);
		expect(modules).not.toContain(contractSource);
		expect(modules).not.toContain(adapterSource);
		expect(modules).toContain(jsonSource);
		expect(modules).toContain(typesSource);
		expect(modules).not.toContain(`\0${applicationContract}`);
		expect(modules).not.toContain(`\0${applicationSchema}`);
		expect(modules).not.toContain(`\0${databaseRuntime}`);
		expect(modules).not.toContain(serverSource);
		expect(modules).not.toContain(openAPISource);
		expect(modules).not.toContain(routerSource);
		expect(modules.some((id) => id.includes("@standard-schema") || id.includes("urlpattern"))).toBe(false);
	});

	it("allows only the explicitly imported schema-free router runtime for href clients", async () => {
		const modules = await bundleModules(`
			import type { applicationAPI } from ${JSON.stringify(applicationContract)};
			import { createClient } from ${JSON.stringify(clientSource)};
			import { codec, route } from ${JSON.stringify(routerSource)};

			const customRoute = route("/custom/:code", {
				params: {
					code: codec.schema({
						parse: (value: string) => value,
						format: (value: string) => value,
					}),
				},
			});
			const client = createClient<typeof applicationAPI>();

			export const request = () => client.GET(customRoute.path, {
				href: customRoute.href({ params: { code: "ABC" } }),
			});
		`);

		expect(modules).toContain(clientSource);
		expect(modules).toContain(routerSource);
		expect(modules).not.toContain(`\0${applicationContract}`);
		expect(modules).not.toContain(`\0${applicationSchema}`);
		expect(modules).not.toContain(`\0${databaseRuntime}`);
		expect(modules).not.toContain(serverSource);
		expect(modules).not.toContain(openAPISource);
		expect(modules.some((id) => id.includes("@standard-schema") || id.includes("urlpattern"))).toBe(false);
	});
});

async function bundleModules(entrySource: string): Promise<string[]> {
	return (await bundleOutput(entrySource)).modules;
}

async function bundleOutput(entrySource: string): Promise<{ readonly code: string; readonly modules: string[] }> {
	const entry = "client-entry.ts";
	const modules = new Set<string>();
	const bundle = await rolldown({
		input: entry,
		plugins: [sourceResolver(), virtualModules(entry, entrySource), moduleCollector(modules)],
	});

	try {
		const { output } = await bundle.generate({ format: "es", minify: true });
		const generated = output[0];

		if (generated?.type !== "chunk") {
			throw new TypeError("Expected one JavaScript output chunk");
		}

		return { code: generated.code, modules: [...modules] };
	} finally {
		await bundle.close();
	}
}

function virtualModules(entry: string, entrySource: string): Plugin {
	const sources = new Map([
		[entry, entrySource],
		[
			applicationContract,
			`import ${JSON.stringify(applicationSchema)}; import ${JSON.stringify(databaseRuntime)};
			 export declare const applicationAPI: import(${JSON.stringify(contractSource)}).API;`,
		],
		[applicationSchema, "throw new Error('Application validator entered the browser graph');"],
		[databaseRuntime, "throw new Error('Database runtime entered the browser graph');"],
	]);

	return {
		name: "http-contract-test:virtual-modules",
		resolveId(id) {
			return sources.has(id) ? `\0${id}` : null;
		},
		load(id) {
			const source = sources.get(id.slice(1));

			return source === undefined ? null : { code: source, moduleType: "ts" };
		},
	};
}

function sourceResolver(): Plugin {
	return {
		name: "http-contract-test:source-resolver",
		resolveId(id, importer) {
			if (id === "@serve-tools/router") {
				return routerSource;
			}
			if (importer?.startsWith(dirname(contractSource)) && id.startsWith(".") && id.endsWith(".js")) {
				return resolve(dirname(importer), id).replace(/\.js$/, ".ts");
			}

			return null;
		},
	};
}

function moduleCollector(modules: Set<string>): Plugin {
	return {
		name: "http-contract-test:module-collector",
		moduleParsed({ id }) {
			modules.add(id);
		},
	};
}
