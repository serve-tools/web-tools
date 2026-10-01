import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { auditPageReferences, buildPages } from "./build-pages.mjs";

test("builds every demo and the Base gallery before generating package pages", async () => {
	const repositoryDirectory = await mkdtemp(path.join(os.tmpdir(), "serve-tools-pages-"));
	const demos = [
		workspace(repositoryDirectory, "client/context/demo", "@serve-tools/client-context-demo"),
		workspace(repositoryDirectory, "client/db/demo", "@serve-tools/client-db-demo"),
		workspace(repositoryDirectory, "client/input/demo", "@serve-tools/client-input-demo"),
		workspace(repositoryDirectory, "client/interaction/demo", "@serve-tools/client-interaction-demo"),
		workspace(repositoryDirectory, "client/keyboard/demo", "@serve-tools/client-keyboard-demo"),
		workspace(repositoryDirectory, "client/messaging/demo", "@serve-tools/client-messaging-demo"),
		workspace(repositoryDirectory, "client/shared-db/demo", "@serve-tools/client-shared-db-demo"),
		workspace(repositoryDirectory, "client/storage/demo", "@serve-tools/client-storage-demo"),
		workspace(repositoryDirectory, "client-signals/dom/demo", "@serve-tools/signal-dom-demo"),
		workspace(repositoryDirectory, "lit/signals/demo", "@serve-tools/lit-signals-demo"),
	];
	const base = workspace(repositoryDirectory, "components/base", "@serve-tools/base-components");
	const workspaceInventory = inventory([...demos, base]);
	const calls = [];

	try {
		await write(path.join(repositoryDirectory, "demo/index.html"), "landing");
		for (const demo of demos) {
			await write(path.join(demo.root, "dist/index.html"), demo.name);
		}
		await write(path.join(repositoryDirectory, "dist/base-gallery/index.html"), "base");

		await buildPages({
			repositoryDirectory,
			workspaceInventory,
			npmPath: "/npm-cli.js",
			execute(command, arguments_, options) {
				calls.push({ command, arguments_, options });
			},
			async buildSite(options) {
				assert.equal(
					await readFile(path.join(options.pagesDirectory, "client/context/index.html"), "utf8"),
					"@serve-tools/client-context-demo",
				);
				assert.equal(
					await readFile(path.join(options.pagesDirectory, "components/base/index.html"), "utf8"),
					"base",
				);
				assert.equal(options.repositoryDirectory, repositoryDirectory);
				assert.equal(options.workspaceInventory, workspaceInventory);
				assert.deepEqual(options.demos, demos);
				assert.equal(options.baseDemoPath, "components/base/");

				await write(
					path.join(options.pagesDirectory, "packages/index.html"),
					'<a href="../client/context/?source=catalog#demo">Context demo</a>',
				);
			},
		});

		assert.equal(await readFile(path.join(repositoryDirectory, "dist/pages/index.html"), "utf8"), "landing");
		assert.deepEqual(
			calls.map(({ arguments_ }) => arguments_),
			[
				["/npm-cli.js", "run", "build:typescript"],
				["/npm-cli.js", "run", "typecheck:local", ...workspaceArguments(demos)],
				["/npm-cli.js", "run", "build:bundle", ...workspaceArguments(demos)],
				["/npm-cli.js", "run", "build:dependencies", "--workspace", base.name],
				["/npm-cli.js", "run", "build", "--workspace", base.name],
				["/npm-cli.js", "run", "typecheck:local", "--workspace", base.name],
				["/npm-cli.js", "run", "build:bundle", "--workspace", base.name],
			],
		);
		assert.ok(
			calls.every(({ command, options }) => command === process.execPath && options.cwd === repositoryDirectory),
		);
		assert.ok(calls.every(({ options }) => options.stdio === "inherit"));
	} finally {
		await rm(repositoryDirectory, { force: true, recursive: true });
	}
});

test("audits nested HTML references with browser URL semantics", async () => {
	const pagesDirectory = await mkdtemp(path.join(os.tmpdir(), "serve-tools-pages-audit-"));

	try {
		await write(
			path.join(pagesDirectory, "index.html"),
			[
				'<a href="./guide/?mode=all&amp;sort=name#examples">Guide</a>',
				'<a href="?mode=summary#top">This page</a>',
				'<a href="#contents">Contents</a>',
				'<a href="https://example.com/">External</a>',
				'<a href="//cdn.example.com/library.js">CDN</a>',
				'<a href="mailto:docs@example.com">Email</a>',
				'<img src="data:image/svg+xml,%3Csvg%3E" alt="Embedded" />',
				"<script>const example = '<img src=\"not-a-real-reference.svg\">';</script>",
			].join("\n"),
		);
		await write(
			path.join(pagesDirectory, "guide/index.html"),
			[
				'<link href="../assets/site.css?v=1#theme" rel="stylesheet" />',
				'<img src="../assets/avatar%20one.svg?size=small#avatar" alt="Avatar" />',
				'<img src="../assets/what%3Ffile%231.svg" alt="Encoded URL characters" />',
				'<script src="../assets/app.js"></script>',
			].join("\n"),
		);
		await write(path.join(pagesDirectory, "assets/site.css"), "body {}");
		await write(path.join(pagesDirectory, "assets/avatar one.svg"), "<svg></svg>");
		await write(path.join(pagesDirectory, "assets/what?file#1.svg"), "<svg></svg>");
		await write(path.join(pagesDirectory, "assets/app.js"), "");

		await auditPageReferences(pagesDirectory);
	} finally {
		await rm(pagesDirectory, { force: true, recursive: true });
	}
});

test("reports missing assets and directory pages from nested HTML", async () => {
	const pagesDirectory = await mkdtemp(path.join(os.tmpdir(), "serve-tools-pages-audit-"));

	try {
		await write(
			path.join(pagesDirectory, "components/base/examples/index.html"),
			'<img src="./avatar.svg?size=small#avatar" /><a href="./missing-page/">Missing page</a>',
		);

		await assert.rejects(auditPageReferences(pagesDirectory), (error) => {
			assert.match(
				error.message,
				/components\/base\/examples\/index\.html: missing local reference "\.\/avatar\.svg\?size=small#avatar"/u,
			);
			assert.match(
				error.message,
				/components\/base\/examples\/index\.html: missing local reference "\.\/missing-page\/"/u,
			);
			return true;
		});
	} finally {
		await rm(pagesDirectory, { force: true, recursive: true });
	}
});

test("rejects local references that escape the Pages root", async () => {
	const temporaryDirectory = await mkdtemp(path.join(os.tmpdir(), "serve-tools-pages-audit-"));
	const pagesDirectory = path.join(temporaryDirectory, "pages");

	try {
		await write(path.join(temporaryDirectory, "secret.txt"), "outside");
		await write(path.join(pagesDirectory, "index.html"), '<a href="../secret.txt">Outside</a>');

		await assert.rejects(
			auditPageReferences(pagesDirectory),
			/reference escapes the Pages root: "\.\.\/secret\.txt"/u,
		);
	} finally {
		await rm(temporaryDirectory, { force: true, recursive: true });
	}
});

test("rejects public demos before invoking build commands", async () => {
	const repositoryDirectory = await mkdtemp(path.join(os.tmpdir(), "serve-tools-pages-"));
	const demo = workspace(repositoryDirectory, "client/context/demo", "@serve-tools/client-context-demo");
	demo.manifest.private = false;
	const base = workspace(repositoryDirectory, "components/base", "@serve-tools/base-components");

	try {
		await assert.rejects(
			buildPages({
				repositoryDirectory,
				workspaceInventory: inventory([demo, base]),
				npmPath: "/npm-cli.js",
				execute() {
					assert.fail("build command should not run");
				},
			}),
			/Pages demo must be a named private workspace: client\/context\/demo/,
		);
	} finally {
		await rm(repositoryDirectory, { force: true, recursive: true });
	}
});

function workspace(repositoryDirectory, location, name) {
	return { location, manifest: { name, private: true }, name, root: path.join(repositoryDirectory, location) };
}

function inventory(workspaces) {
	return {
		workspaces,
		publicWorkspaces: [],
		privateWorkspaces: workspaces,
		workspacesByName: new Map(workspaces.map((entry) => [entry.name, entry])),
	};
}

function workspaceArguments(workspaces) {
	return workspaces.flatMap(({ name }) => ["--workspace", name]);
}

async function write(file, contents) {
	await mkdir(path.dirname(file), { recursive: true });
	await writeFile(file, contents);
}
