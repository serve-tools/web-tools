import { assert, loadSolution } from "../_shared.mjs";

const { createRouteCatalog } = await loadSolution();
assert.equal(typeof createRouteCatalog, "function");

const catalog = createRouteCatalog();
assert.equal(
	catalog.build("project", { params: { projectId: 42 }, search: { tag: ["new", "hot"], q: "red blue" } }),
	"/projects/42?tag=new&tag=hot&q=red+blue",
);
assert.deepEqual(catalog.parse("https://example.test/projects/42?view=activity&tag=a&tag=b&ignored=x"), {
	kind: "project",
	params: { projectId: 42 },
	search: { view: "activity", tag: ["a", "b"], q: undefined },
});
assert.equal(catalog.parse("/projects/01"), null);
