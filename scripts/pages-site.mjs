import { execFileSync } from "node:child_process";
import { statSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join, posix } from "node:path";
import { Marked } from "marked";
import { readPublishedVersions } from "./release-plan.mjs";

const repositoryURL = "https://github.com/serve-tools/web-tools";
const escape = (value) =>
	String(value).replace(
		/[&<>"']/g,
		(character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character],
	);
const slug = (name) => name.replace("@serve-tools/", "");

export function renderReadme(markdown, location, revision, packages, repositoryDirectory) {
	const rewrite = (href, image = false) => {
		if (/^(?:https?:|mailto:|#)/i.test(href)) {
			return href;
		}
		if (/^[a-z][a-z\d+.-]*:/i.test(href) || href.startsWith("//")) {
			return "#";
		}
		const [pathname, fragment] = href.split("#");
		const target = posix.normalize(posix.join(location, pathname));
		const library = packages.find((entry) => target.replace(/\/(?:README\.md)?$/, "") === entry.location);
		if (!image && library) {
			return `../${slug(library.name)}/${fragment ? `#${fragment}` : ""}`;
		}
		const demo = packages.find((entry) => target.replace(/\/$/, "") === `${entry.location}/demo` && entry.demo);
		if (!image && demo) {
			return `../../${demo.demo}`;
		}
		const baseExample = /^components\/base\/examples\/(index|template)\.html$/.exec(target);
		const baseDemo = packages.find((entry) => entry.location === "components/base")?.demo;
		if (!image && baseExample && baseDemo) {
			return `../../${baseDemo}${baseExample[1] === "template" ? "template.html" : ""}${fragment ? `#${fragment}` : ""}`;
		}
		const directory =
			repositoryDirectory &&
			statSync(join(repositoryDirectory, target), { throwIfNoEntry: false })?.isDirectory();
		const base = image
			? `https://raw.githubusercontent.com/serve-tools/web-tools/${revision}`
			: `${repositoryURL}/${directory ? "tree" : "blob"}/${revision}`;
		return `${base}/${target}${fragment ? `#${fragment}` : ""}`;
	};
	const headings = new Map();
	const parser = new Marked({
		renderer: {
			heading({ tokens, depth }) {
				const text = this.parser.parseInline(tokens);
				const base = text
					.replace(/<[^>]*>/g, "")
					.toLowerCase()
					.replace(/[^\p{L}\p{N}_\-\s]/gu, "")
					.replace(/\s/g, "-");
				const count = headings.get(base) ?? 0;
				headings.set(base, count + 1);
				return `<h${depth} id="${escape(base)}${count ? `-${count}` : ""}">${text}</h${depth}>`;
			},
			link({ href, title, tokens }) {
				return `<a href="${escape(rewrite(href))}"${title ? ` title="${escape(title)}"` : ""}>${this.parser.parseInline(tokens)}</a>`;
			},
			image({ href, text }) {
				return `<img src="${escape(rewrite(href, true))}" alt="${escape(text)}" loading="lazy">`;
			},
			html({ text }) {
				return escape(text);
			},
		},
	});
	return parser.parse(markdown.replace(/^# [^\n]+\n/, ""));
}

function document(title, prefix, body, revision) {
	return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="description" content="Current @serve-tools package documentation, availability, and interactive demos."><title>${escape(title)} · serve-tools</title><link rel="stylesheet" href="${prefix}style.css"></head><body><nav class="topbar"><a class="wordmark" href="${prefix}">@serve-tools / web-tools</a><a href="${repositoryURL}">GitHub ↗</a></nav>${body}<footer><span>Documentation from <a href="${repositoryURL}/tree/${revision}"><code>${revision.slice(0, 7)}</code></a>. npm availability checked at build time.</span><a href="${prefix}packages.json">Package inventory</a></footer></body></html>`;
}

export async function buildPackageSite({
	repositoryDirectory,
	pagesDirectory,
	workspaceInventory,
	demos = [],
	baseDemoPath = "components/base/",
	publishedVersions,
	revision,
}) {
	revision ??= execFileSync("git", ["rev-parse", "HEAD"], { cwd: repositoryDirectory, encoding: "utf8" }).trim();
	const libraries = workspaceInventory.workspaces.filter(
		({ manifest, location }) => !manifest.private || location === "components/base",
	);
	publishedVersions ??= await readPublishedVersions(libraries.filter(({ manifest }) => !manifest.private));
	const packages = libraries.map(({ name, location, manifest }) => {
		const versions = publishedVersions.get(name) ?? [];
		const status = manifest.private
			? "Private preview"
			: versions.includes(manifest.version)
				? "Published version"
				: versions.length
					? "Unreleased version"
					: "Not yet published";
		const npmVersion =
			versions
				.filter((version) => /^\d+\.\d+\.\d+$/.test(version))
				.sort((a, b) => a.localeCompare(b, "en", { numeric: true }))
				.at(-1) ?? null;
		return {
			name,
			location,
			npmVersion,
			version: manifest.version,
			description: manifest.description ?? "",
			status,
			url: `packages/${slug(name)}/`,
			demo:
				location === "components/base"
					? baseDemoPath
					: demos.some((entry) => entry.location === `${location}/demo`)
						? `${location}/`
						: null,
		};
	});
	await mkdir(pagesDirectory, { recursive: true });
	await writeFile(
		join(pagesDirectory, "packages.json"),
		`${JSON.stringify({ revision, generatedAt: new Date().toISOString(), packages }, null, 2)}\n`,
	);
	await writeFile(join(pagesDirectory, ".nojekyll"), "");
	for (const entry of packages) {
		const readme = await readFile(join(repositoryDirectory, entry.location, "README.md"), "utf8");
		const body = `<header class="package-header"><a href="../../">← All packages</a><p class="eyebrow">${escape(entry.location.split("/")[0])}</p><h1>${escape(entry.name)}</h1><p>${escape(entry.description)}</p><p class="metadata"><span class="badge">${entry.status}</span> Repository version ${escape(entry.version)}</p><nav class="actions"><a href="${repositoryURL}/tree/${revision}/${entry.location}">Source ↗</a>${entry.npmVersion ? `<a href="https://www.npmjs.com/package/${entry.name}/v/${entry.npmVersion}">npm ${entry.npmVersion} ↗</a>` : ""}${entry.demo ? `<a href="../../${entry.demo}">Live demo ↗</a>` : ""}</nav><aside>These docs follow the repository source. ${entry.status === "Published version" ? "The displayed version is available on npm." : "The displayed version is not available on npm; installation examples describe the intended package API."}</aside></header><main class="documentation">${renderReadme(readme, entry.location, revision, packages, repositoryDirectory)}</main>`;
		await mkdir(join(pagesDirectory, entry.url), { recursive: true });
		await writeFile(join(pagesDirectory, entry.url, "index.html"), document(entry.name, "../../", body, revision));
	}
	const groups = [...new Set(packages.map((entry) => entry.location.split("/")[0]))];
	const sections = groups
		.map(
			(group) =>
				`<section data-group="${group}"><div class="section-heading"><p class="eyebrow">${group}</p><h2>${group === "suite" ? "Package selection" : group.replaceAll("-", " ")}</h2></div><div class="package-cards">${packages
					.filter((entry) => entry.location.split("/")[0] === group)
					.map(
						(entry) =>
							`<article data-package data-search="${escape(`${entry.name} ${entry.description} ${entry.status}`.toLowerCase())}"><p class="metadata"><span class="badge">${entry.status}</span><span>${escape(entry.version)}</span></p><h3><a href="${entry.url}">${escape(slug(entry.name))}</a></h3><p>${escape(entry.description)}</p><nav class="actions"><a href="${entry.url}">Read docs →</a>${entry.demo ? `<a href="${entry.demo}">Live demo ↗</a>` : ""}</nav></article>`,
					)
					.join("")}</div></section>`,
		)
		.join("");
	const body = `<header><p class="eyebrow">Web platform libraries</p><h1>Small tools,<br>native foundations.</h1><p>Typed APIs, composable components, and tools built on the web platform.</p><p class="stats">${packages.length} packages · ${packages.filter((entry) => entry.demo).length} live demos · published and upcoming</p></header><main><section class="catalog-tools"><label for="package-search">Find a package</label><input id="package-search" type="search" placeholder="Search names, capabilities, or publication status"><p id="result-count" role="status">Showing all ${packages.length} packages</p><nav class="group-links" aria-label="Package categories">${groups.map((group) => `<a href="#${group}">${group}</a>`).join("")}</nav><p>Documentation follows the latest repository source, including unreleased packages and the private Base preview. Each page shows npm availability for its repository version.</p></section>${sections.replace(/data-group="([^"]+)"/g, 'id="$1" data-group="$1"')}</main><script type="module" src="catalog.js"></script>`;
	await writeFile(join(pagesDirectory, "index.html"), document("Packages & demos", "./", body, revision));
	console.log(`Generated documentation for ${packages.length} packages.`);
	return packages;
}
