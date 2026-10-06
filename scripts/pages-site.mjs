import { execFileSync } from "node:child_process";
import { statSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join, posix } from "node:path";
import { Marked } from "marked";
import { combinedMembers, describePackage, relatedPackages } from "./pages-catalog.mjs";
import { readPublishedVersions } from "./release-plan.mjs";

const repositoryURL = "https://github.com/serve-tools/web-tools";
const escape = (value) =>
	String(value).replace(
		/[&<>"']/g,
		(character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character],
	);
const slug = (name) => name.replace("@serve-tools/", "");
const patternEscape = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export function renderReadme(markdown, location, revision, packages, repositoryDirectory) {
	const entry = packages.find((entry) => entry.location === location);
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
			code({ text, lang }) {
				const language = lang?.split(/\s/)[0] ?? "text";
				const install = entry && text.includes(`npm install`) && text.includes(entry.name);
				const cdn = entry && text.includes(`https://esm.run/${entry.name}`);
				if ((install || cdn) && entry.status !== "Published version") {
					return `<p class="preview-install">This ${escape(entry.version)} API is not available on npm. Use a repository checkout to explore this example; ${entry.npmVersion ? `the <a href="https://www.npmjs.com/package/${entry.name}/v/${entry.npmVersion}">published ${entry.npmVersion} release</a> has its own versioned README.` : "a published installation is not available."}</p>`;
				}
				if (install) {
					text = text.replace(
						new RegExp(`${patternEscape(entry.name)}(?=\\s|$)`, "g"),
						`${entry.name}@${entry.version}`,
					);
				}
				if (cdn) {
					text = text.replace(
						new RegExp(`https://esm\\.run/${patternEscape(entry.name)}(?=[/"'])`, "g"),
						`https://esm.run/${entry.name}@${entry.version}`,
					);
				}
				const label =
					{
						ts: "TypeScript",
						js: "JavaScript",
						shell: "Terminal",
						sh: "Terminal",
						html: "HTML",
						css: "CSS",
						json: "JSON",
					}[language] ?? language;
				return `<div class="code-example"><div class="code-toolbar"><span>${escape(label)}</span><button type="button" class="copy-code" aria-label="Copy ${escape(label)} example" hidden>Copy</button></div><pre><code${lang ? ` class="language-${escape(language)}"` : ""}>${escape(text)}\n</code></pre></div>`;
			},
			html({ text }) {
				return escape(text);
			},
		},
	});
	return parser.parse(markdown.replace(/^# [^\n]+\n/, ""));
}

function document(title, prefix, body, revision, localPreview) {
	return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="description" content="Practical examples and package guidance for @serve-tools web platform libraries."><title>${escape(title)} · serve-tools</title><link rel="stylesheet" href="${prefix}style.css"></head><body><a class="skip-link" href="#main">Skip to content</a>${localPreview ? '<div class="review-banner">Local review preview · includes working-tree changes · nothing has been pushed</div>' : ""}<nav class="topbar" aria-label="Main navigation"><a class="wordmark" href="${prefix}">@serve-tools / web-tools</a><a href="${repositoryURL}">GitHub ↗</a></nav>${body}<footer><span>${localPreview ? "Local source based on" : "Documentation from"} <a href="${repositoryURL}/tree/${revision}"><code>${escape(revision.slice(0, 7))}</code></a>. npm availability checked at build time.</span><a href="${prefix}packages.json">Package inventory</a></footer><script type="module" src="${prefix}docs.js"></script></body></html>`;
}

function availability(entry) {
	if (entry.status === "Published version") {
		return `<p class="availability-note">The displayed version is available on npm. Installation commands below select <code>${escape(entry.name)}@${escape(entry.version)}</code>.</p>`;
	}
	return `<aside class="availability-note preview"><strong>${entry.status === "Private preview" ? "Private repository preview" : `Preview API · ${escape(entry.version)}`}</strong><p>The displayed version is not available on npm. These examples describe the repository API and require a checkout.${entry.npmVersion ? ` For a published installation, use the <a href="https://www.npmjs.com/package/${entry.name}/v/${entry.npmVersion}">${escape(entry.npmVersion)} release and its README</a>.` : ""}</p></aside>`;
}

function contents(html) {
	const headings = [...html.matchAll(/<h2 id="([^"]+)">([\s\S]*?)<\/h2>/g)];
	return `<nav class="page-contents" aria-label="On this page"><p>On this page</p><ul>${headings.map(([, id, title]) => `<li><a href="#${id}">${title}</a></li>`).join("")}</ul></nav>`;
}

function packageCard(entry) {
	return `<article data-package><p class="card-context">${escape(entry.environment)}${entry.kind === "foundation" ? " · Advanced foundation" : ""}</p><h3><a href="${entry.url}">${escape(entry.name)}</a></h3><p class="package-subtitle">${escape(entry.title)}</p><p>${escape(entry.description)}</p><nav class="actions"><a href="${entry.url}">See examples →</a>${entry.demo ? `<a href="${entry.demo}">Try demo ↗</a>` : ""}</nav><p class="metadata"><span class="badge${entry.status === "Published version" ? "" : " preview-badge"}">${entry.status}</span><span>${escape(entry.version)}</span></p></article>`;
}

function combinedRow(entry, packages) {
	const members = packages.filter((other) => entry.members.includes(other.name));
	return `<article class="combined-package" data-package><div><p class="eyebrow">Optional combined package</p><h3><a href="${entry.url}">${escape(entry.name)}</a></h3><p>${escape(entry.description)} Choose a focused package for one capability.</p></div><div class="combined-actions"><a href="${entry.url}">Compare imports →</a><p class="metadata"><span class="badge${entry.status === "Published version" ? "" : " preview-badge"}">${entry.status}</span><span>${escape(entry.version)}</span></p></div><details><summary>Includes ${members.length} packages · view exact membership</summary><ul class="member-links">${members.map((member) => `<li><a href="${member.url}">${escape(member.name)}</a></li>`).join("")}</ul></details></article>`;
}

export async function buildPackageSite({
	repositoryDirectory,
	pagesDirectory,
	workspaceInventory,
	demos = [],
	baseDemoPath = "components/base/",
	publishedVersions,
	revision,
	localPreview = process.env.SERVE_TOOLS_DOCS_PREVIEW === "1",
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
			...describePackage({ name, location }),
			members: combinedMembers({ name, manifest }, libraries),
			manifestDescription: manifest.description ?? "",
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
		`${JSON.stringify({ revision, localPreview, generatedAt: new Date().toISOString(), packages }, null, 2)}\n`,
	);
	await writeFile(join(pagesDirectory, ".nojekyll"), "");
	for (const entry of packages) {
		const readme = await readFile(join(repositoryDirectory, entry.location, "README.md"), "utf8");
		const html = renderReadme(readme, entry.location, revision, packages, repositoryDirectory);
		const related = relatedPackages(entry, packages);
		const body = `<header class="package-header"><a href="../../#${escape(entry.location.split("/")[0])}">← Browse packages</a><p class="eyebrow">${escape(entry.environment)}${entry.kind === "combined" ? " · Optional combined package" : entry.kind === "foundation" ? " · Advanced foundation" : ""}</p><h1>${escape(entry.name)}</h1><p class="package-subtitle">${escape(entry.title)}</p><p>${escape(entry.description)}</p><p class="metadata"><span class="badge${entry.status === "Published version" ? "" : " preview-badge"}">${entry.status}</span> Documentation version ${escape(entry.version)}</p><nav class="actions"><a href="${repositoryURL}/tree/${revision}/${entry.location}">${localPreview ? "Committed source" : "Source"} ↗</a>${entry.npmVersion ? `<a href="https://www.npmjs.com/package/${entry.name}/v/${entry.npmVersion}">npm ${entry.npmVersion} ↗</a>` : ""}${entry.demo ? `<a href="../../${entry.demo}">Try live demo ↗</a>` : ""}</nav>${availability(entry)}</header><main id="main" class="docs-layout">${contents(html)}<div class="documentation">${html}${related.length ? `<section class="related-packages"><h2 id="related-packages">Choose a related tool</h2><ul>${related.map((other) => `<li><a href="../${slug(other.name)}/">${escape(other.name)}</a><span>${escape(other.description)}</span></li>`).join("")}</ul></section>` : ""}</div></main>`;
		await mkdir(join(pagesDirectory, entry.url), { recursive: true });
		await writeFile(
			join(pagesDirectory, entry.url, "index.html"),
			document(entry.name, "../../", body, revision, localPreview),
		);
	}
	const groups = [...new Set(packages.map((entry) => entry.location.split("/")[0]))];
	const sections = groups
		.map((group) => {
			const entries = packages.filter((entry) => entry.location.split("/")[0] === group);
			const titles = {
				client: "Browser tools",
				"client-signals": "Reactive browser tools",
				core: "Shared runtime tools",
				signals: "Signal state & effects",
				components: "Web components",
				suite: "Coding agent guidance",
				realtime: "Transport foundations",
				rolldown: "Rolldown integrations",
				lit: "Lit integrations",
				vite: "Vite integrations",
				server: "Server transports",
				polyfills: "Native-aware & global compatibility",
				ponyfills: "Explicit fallback implementations",
			};
			return `<section id="${group}" data-group="${group}" class="catalog-group"><div class="section-heading"><h2>${group}</h2><p>${titles[group]}</p></div><div class="package-cards">${entries
				.filter((entry) => entry.kind !== "combined")
				.map(packageCard)
				.join("")}</div>${entries
				.filter((entry) => entry.kind === "combined")
				.map((entry) => combinedRow(entry, packages))
				.join("")}</section>`;
		})
		.join("");
	const body = `<header class="catalog-header"><p class="eyebrow">Web platform libraries</p><h1>Small tools.<br>Useful things.</h1><p>Focused, typed libraries built on the web platform.</p><div class="hero-actions"><a class="primary-link" href="#packages">Browse categories ↓</a><a href="packages/client-storage/">See a small example →</a></div><p class="stats">${packages.filter((entry) => entry.kind !== "combined").length} focused packages · ${packages.filter((entry) => entry.kind === "combined").length} optional combined packages · ${packages.filter((entry) => entry.demo).length} live demos</p></header><main id="main"><nav id="packages" class="catalog-tools" aria-label="Package categories"><div><p class="eyebrow">Explore the collection</p><h2>Package categories</h2></div><div class="group-links">${groups.map((group) => `<a href="#${group}">${group}</a>`).join("")}</div><p class="catalog-note">Choose a focused package for one capability, or a combined package for several. Published releases and repository previews are labeled separately.</p></nav>${sections}</main>`;
	await writeFile(
		join(pagesDirectory, "index.html"),
		document("Packages & examples", "./", body, revision, localPreview),
	);
	console.log(`Generated documentation for ${packages.length} packages.`);
	return packages;
}
