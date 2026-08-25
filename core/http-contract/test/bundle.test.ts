import type { Plugin } from "rolldown";
import { rolldown } from "rolldown";
import { describe, expect, it } from "vitest";

const clientSource = new URL("../src/client.ts", import.meta.url).pathname;
const contractSource = new URL("../src/http-contract.ts", import.meta.url).pathname;
const jsonSource = new URL("../src/lib/json.ts", import.meta.url).pathname;
const typesSource = new URL("../src/lib/types.ts", import.meta.url).pathname;
const serverSource = new URL("../src/server.ts", import.meta.url).pathname;
const openAPISource = new URL("../src/openapi.ts", import.meta.url).pathname;
const routerSource = new URL("../../router/src/router.ts", import.meta.url).pathname;

const applicationContract = "application-contract.ts";
const applicationSchema = "application-schema.ts";
const databaseRuntime = "database-runtime.ts";

describe("client browser bundle isolation", () => {
	it("erases the application contract and excludes trusted and router runtimes from native clients", async () => {
		const modules = await bundleModules(`
			import type { applicationAPI } from ${JSON.stringify(applicationContract)};
			import { createClient } from ${JSON.stringify(clientSource)};

			export const client = createClient<typeof applicationAPI>();
		`);

		expect(modules).toContain(clientSource);
		expect(modules).toContain(contractSource);
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
	const entry = "client-entry.ts";
	const modules = new Set<string>();
	const bundle = await rolldown({
		input: entry,
		plugins: [sourceResolver(), virtualModules(entry, entrySource), moduleCollector(modules)],
	});

	try {
		await bundle.generate({ format: "es", minify: true });

		return [...modules];
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
			if (importer === clientSource && id === "./http-contract.js") {
				return contractSource;
			}
			if (importer === clientSource && id === "./lib/json.js") {
				return jsonSource;
			}
			if (importer === contractSource && id === "./lib/types.js") {
				return typesSource;
			}
			if (importer === jsonSource && id === "../http-contract.js") {
				return contractSource;
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
