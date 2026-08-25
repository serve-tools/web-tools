import { rolldown } from "rolldown";
import { describe, expect, it } from "vitest";

const routerSource = new URL("../src/router.ts", import.meta.url).pathname;

async function bundleExport(name: "route" | "codec"): Promise<string> {
	const entry = `\0router-${name}`;
	const bundle = await rolldown({
		input: entry,
		plugins: [
			{
				name: "router-tree-shaking-test",
				resolveId(id) {
					return id === entry ? id : null;
				},
				load(id) {
					return id === entry ? `export { ${name} } from ${JSON.stringify(routerSource)};` : null;
				},
			},
		],
	});

	try {
		const { output } = await bundle.generate({ format: "es", minify: true });
		const generated = output[0];
		if (generated?.type !== "chunk") {
			throw new TypeError("Expected one JavaScript output chunk");
		}

		return generated.code;
	} finally {
		await bundle.close();
	}
}

describe("router tree shaking", () => {
	it("removes every codec factory from route-only consumers", async () => {
		const generated = await bundleExport("route");

		expect(generated).not.toContain("Number.isSafeInteger");
		expect(generated).not.toContain("enum:");
		expect(generated).not.toContain("optional:");
		expect(generated).not.toContain("many:");
	});

	it("removes URL matching from codec-only consumers", async () => {
		const generated = await bundleExport("codec");

		expect(generated).not.toContain("URLPattern");
		expect(generated).not.toContain("URLSearchParams");
	});
});
