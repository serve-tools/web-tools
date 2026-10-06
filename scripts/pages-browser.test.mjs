import assert from "node:assert/strict";
import { once } from "node:events";
import { cp, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { buildPackageSite } from "./pages-site.mjs";
import { createPagesPreview } from "./preview-pages.mjs";
import { readWorkspaceInventory } from "./workspaces.mjs";

const repositoryDirectory = fileURLToPath(new URL("../", import.meta.url));

test("the whole documentation site works on desktop and mobile with category navigation and separate combined packages", async () => {
	const pagesDirectory = await mkdtemp(join(tmpdir(), "serve-tools-docs-browser-"));
	let browser;
	let server;
	try {
		await cp(join(repositoryDirectory, "demo"), pagesDirectory, { recursive: true });
		const workspaceInventory = await readWorkspaceInventory(repositoryDirectory);
		const publishedVersions = new Map(
			workspaceInventory.publicWorkspaces.map(({ name, manifest }) => [name, [manifest.version]]),
		);
		publishedVersions.set("@serve-tools/client-signals", ["0.0.1"]);
		const packages = await buildPackageSite({
			repositoryDirectory,
			pagesDirectory,
			workspaceInventory,
			publishedVersions,
			revision: "browser-test",
			localPreview: true,
		});
		server = createPagesPreview(pagesDirectory);
		server.listen(0, "127.0.0.1");
		await once(server, "listening");
		const origin = `http://127.0.0.1:${server.address().port}`;
		browser = await chromium.launch();
		const context = await browser.newContext({
			viewport: { width: 1280, height: 900 },
			permissions: ["clipboard-read", "clipboard-write"],
		});
		const page = await context.newPage();
		const errors = [];
		page.on("pageerror", (error) => errors.push(error.message));
		await page.goto(origin);
		assert.equal(await page.locator('input[type="search"], #task-filter').count(), 0);
		await page
			.getByRole("navigation", { name: "Package categories" })
			.getByRole("link", { name: "client", exact: true })
			.click();
		assert.equal(new URL(page.url()).hash, "#client");
		assert.equal(await page.locator("#client h2").textContent(), "client");
		assert.equal(
			await page.locator("#client .package-cards h3").first().textContent(),
			"@serve-tools/client-context",
		);
		assert.equal(await page.locator("[data-package]:visible").count(), packages.length);
		assert.equal(await page.locator(".combined-package").count(), 3);
		assert.ok(
			await page
				.locator(".combined-package")
				.evaluateAll((entries) => entries.every((entry) => !entry.closest(".package-cards"))),
		);

		for (const width of [1280, 375]) {
			await page.setViewportSize({ width, height: 900 });
			for (const route of ["", ...packages.map((entry) => entry.url)]) {
				const response = await page.goto(`${origin}/${route}`, { waitUntil: "domcontentloaded" });
				assert.equal(response.status(), 200, `${width}px ${route}`);
				assert.equal(await page.locator("h1").count(), 1, route);
				const layout = await page.evaluate(() => ({
					width: document.documentElement.clientWidth,
					scroll: document.documentElement.scrollWidth,
				}));
				assert.ok(layout.scroll <= layout.width + 1, `${route} overflows at ${width}px: ${layout.scroll}`);
				const invalidAnchors = await page
					.locator('.page-contents a[href^="#"]')
					.evaluateAll((links) =>
						links
							.filter((link) => !document.getElementById(decodeURIComponent(link.hash.slice(1))))
							.map((link) => link.hash),
					);
				assert.deepEqual(invalidAnchors, [], route);
			}
		}
		await page.goto(`${origin}/packages/client-storage/`);
		await page.getByRole("button", { name: "Copy TypeScript example" }).first().click();
		assert.match(await page.evaluate(() => navigator.clipboard.readText()), /@serve-tools\/client-storage/);
		await page.goto(`${origin}/packages/client-signals/`);
		assert.equal(
			await page.locator("pre").filter({ hasText: "npm install @serve-tools/client-signals" }).count(),
			0,
		);
		assert.ok(await page.getByText("Preview API · 0.3.1").isVisible());
		await page.goto(origin);
		await page.keyboard.press("Tab");
		assert.equal(await page.locator(":focus").textContent(), "Skip to content");
		assert.deepEqual(errors, []);
	} finally {
		await browser?.close();
		if (server) {
			await new Promise((resolve) => server.close(resolve));
		}
		await rm(pagesDirectory, { recursive: true, force: true });
	}
});
