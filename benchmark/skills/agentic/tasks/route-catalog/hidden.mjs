import { assert, loadSolution } from "../_shared.mjs";

const { createRouteCatalog } = await loadSolution();
const catalog = createRouteCatalog();

assert.equal(catalog.build("projectSettings", { params: { projectId: 7 } }), "/projects/7/settings");
assert.deepEqual(catalog.parse("/projects/7/settings?section=security"), {
	kind: "projectSettings",
	params: { projectId: 7 },
	search: { section: "security" },
});
assert.equal(
	catalog.build("asset", { params: { assetId: "été 1", format: "webp" } }),
	"/assets/%C3%A9t%C3%A9%201.webp",
);
assert.deepEqual(catalog.parse(new URL("https://example.test/assets/%C3%A9t%C3%A9%201.webp")), {
	kind: "asset",
	params: { assetId: "été 1", format: "webp" },
	search: {},
});
assert.equal(catalog.parse("/projects/7?view=summary&view=activity"), null);
assert.equal(catalog.parse("/projects/9007199254740992"), null);
assert.equal(catalog.parse("/projects/7?view=other"), null);
assert.throws(() => catalog.build("project", { params: { projectId: 1.5 } }), TypeError);
assert.throws(() => catalog.build("missing", {}), TypeError);
