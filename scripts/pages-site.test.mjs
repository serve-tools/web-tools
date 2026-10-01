import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { buildPackageSite, renderReadme } from "./pages-site.mjs";
import { readWorkspaceInventory } from "./workspaces.mjs";

const repositoryDirectory = fileURLToPath(new URL("../", import.meta.url));

test("all libraries receive complete documentation regardless of npm publication", async () => {
	const pagesDirectory = await mkdtemp(join(tmpdir(), "web-tools-pages-"));
	try {
		const workspaceInventory = await readWorkspaceInventory(repositoryDirectory);
		const published = workspaceInventory.publicWorkspaces[0];
		const publishedVersions = new Map([
			["@serve-tools/client-db", ["0.0.0"]],
			[published.name, [published.manifest.version]],
		]);
		const packages = await buildPackageSite({
			repositoryDirectory,
			pagesDirectory,
			workspaceInventory,
			publishedVersions,
			revision: "test-revision",
		});
		assert.equal(packages.length, workspaceInventory.publicWorkspaces.length + 1);
		assert.equal(new Set(packages.map((entry) => entry.url)).size, packages.length);
		assert.equal(packages.find((entry) => entry.location === "components/base").status, "Private preview");
		assert.equal(packages.find((entry) => entry.location === "client/db").status, "Unreleased version");
		assert.equal(
			packages.find((entry) => entry.location === "ponyfills/custom-element-registry").status,
			"Not yet published",
		);
		for (const entry of packages) {
			const html = await readFile(join(pagesDirectory, entry.url, "index.html"), "utf8");
			assert.ok(html.includes(entry.name));
			assert.ok(
				html.includes(entry.status === "Published version" ? "is available on npm" : "not available on npm"),
			);
			assert.equal((html.match(/<h1[ >]/g) ?? []).length, 1);
			assert.ok(html.endsWith("</html>"));
		}
		const base = await readFile(join(pagesDirectory, "packages/base-components/index.html"), "utf8");
		assert.match(base, /Base Skill/);
		assert.match(base, /MIT-0/);
		assert.equal(
			JSON.parse(await readFile(join(pagesDirectory, "packages.json"), "utf8")).packages.length,
			packages.length,
		);
	} finally {
		await rm(pagesDirectory, { recursive: true, force: true });
	}
});

test("README rendering preserves code, tables, anchors, and source links", () => {
	const html = renderReadme(
		"## Boundaries\n\n[Related](../../ponyfills/example/#boundaries) [Source](./src/example.ts)\n\n```html\n<button>Test</button>\n```\n\n| A | B |\n| - | - |\n| x | y |\n\n<script>alert(1)</script>",
		"polyfills/example",
		"abc123",
		[{ location: "ponyfills/example", name: "@serve-tools/ponyfill-example" }],
	);
	assert.match(html, /id="boundaries"/);
	assert.match(html, /href="\.\.\/ponyfill-example\/#boundaries"/);
	assert.match(html, /blob\/abc123\/polyfills\/example\/src\/example.ts/);
	assert.match(html, /&lt;button&gt;/);
	assert.match(html, /<table>/);
	assert.ok(!html.includes("<script>"));
	assert.match(renderReadme("[Unsafe](javascript:alert%281%29)", "x", "abc", []), /href="#"/);
});

test("README directory links select live demos and commit-pinned source trees", () => {
	const html = renderReadme(
		"[Demo](./demo) [Source](./src/)",
		"client/context",
		"abc123",
		[{ location: "client/context", name: "@serve-tools/client-context", demo: "client/context/" }],
		repositoryDirectory,
	);
	assert.match(html, /href="..\/..\/client\/context\/"/);
	assert.match(html, /tree\/abc123\/client\/context\/src\//);
});

test("Base README example links open deployed galleries and preserve fragments", () => {
	const html = renderReadme(
		"[Input](examples/index.html#component-input) [Template](examples/template.html)",
		"components/base",
		"abc123",
		[{ location: "components/base", name: "@serve-tools/base-components", demo: "components/base/" }],
	);
	assert.match(html, /href="..\/..\/components\/base\/#component-input"/);
	assert.match(html, /href="..\/..\/components\/base\/template.html"/);
});
