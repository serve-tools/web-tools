import { execFileSync } from "node:child_process";
import { cp, mkdir, readdir, readFile, rm, stat } from "node:fs/promises";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { buildPackageSite } from "./pages-site.mjs";
import { readWorkspaceInventory } from "./workspaces.mjs";

const defaultRepositoryDirectory = fileURLToPath(new URL("../", import.meta.url));
const demoLocation = /^(?:client|client-signals|lit)\/[^/]+\/demo$/;
const externalReference = /^(?:[a-z][a-z\d+.-]*:|\/\/)/iu;

/** Verifies that every relative href and src in the generated site resolves inside the site. */
export async function auditPageReferences(pagesDirectory) {
	const pagesRoot = resolve(pagesDirectory);
	const htmlFiles = await findHTMLFiles(pagesRoot);
	const failures = [];

	for (const htmlFile of htmlFiles) {
		const html = await readFile(htmlFile, "utf8");
		const source = relative(pagesRoot, htmlFile);

		for (const reference of findPageReferences(html)) {
			const decodedReference = decodeHTMLAttribute(reference).trim();
			if (decodedReference.startsWith("#") || externalReference.test(decodedReference)) {
				continue;
			}

			let target;
			try {
				target = fileURLToPath(new URL(decodedReference, pathToFileURL(htmlFile)));
			} catch {
				failures.push(`${source}: invalid local reference ${JSON.stringify(reference)}`);
				continue;
			}

			const targetFromRoot = relative(pagesRoot, target);
			if (targetFromRoot === ".." || targetFromRoot.startsWith(`..${sep}`) || isAbsolute(targetFromRoot)) {
				failures.push(`${source}: reference escapes the Pages root: ${JSON.stringify(reference)}`);
				continue;
			}

			if (!(await pageTargetExists(target))) {
				failures.push(`${source}: missing local reference ${JSON.stringify(reference)}`);
			}
		}
	}

	if (failures.length > 0) {
		throw new Error(`Pages reference audit failed:\n${failures.map((failure) => `- ${failure}`).join("\n")}`);
	}

	console.log(`Audited local references in ${htmlFiles.length} HTML files.`);
}

/** Builds the package site and its live examples. */
export async function buildPages({
	repositoryDirectory = defaultRepositoryDirectory,
	pagesDirectory = join(repositoryDirectory, "dist/pages"),
	workspaceInventory,
	npmPath = process.env.npm_execpath,
	execute = execFileSync,
	buildSite = buildPackageSite,
} = {}) {
	if (npmPath === undefined) {
		throw new Error("npm_execpath is unavailable");
	}

	workspaceInventory ??= await readWorkspaceInventory(repositoryDirectory);
	const demos = workspaceInventory.workspaces.filter((workspace) => demoLocation.test(workspace.location));
	const base = workspaceInventory.workspaces.find(({ location }) => location === "components/base");

	for (const demo of demos) {
		if (!demo.manifest.private || typeof demo.name !== "string") {
			throw new Error(`Pages demo must be a named private workspace: ${demo.location}`);
		}
	}
	if (!base?.manifest.private || base.name !== "@serve-tools/base-components") {
		throw new Error("Pages requires the private @serve-tools/base-components workspace");
	}

	await rm(pagesDirectory, { force: true, recursive: true });
	await mkdir(dirname(pagesDirectory), { recursive: true });
	await cp(join(repositoryDirectory, "demo"), pagesDirectory, { recursive: true });

	const run = (script, workspaces = []) => {
		const workspaceArguments = workspaces.flatMap((name) => ["--workspace", name]);
		execute(process.execPath, [npmPath, "run", script, ...workspaceArguments], {
			cwd: repositoryDirectory,
			stdio: "inherit",
		});
	};
	const demoNames = demos.map((demo) => demo.name);

	console.log("Building the shared TypeScript project graph…");
	run("build:typescript");

	console.log(`Typechecking ${demos.length} demos against the shared graph…`);
	run("typecheck:local", demoNames);

	console.log(`Bundling ${demos.length} demos…`);
	run("build:bundle", demoNames);

	console.log("Building the Base component gallery…");
	run("build:dependencies", [base.name]);
	run("build", [base.name]);
	run("typecheck:local", [base.name]);
	run("build:bundle", [base.name]);

	for (const demo of demos) {
		const destination = join(pagesDirectory, demo.location.slice(0, -"/demo".length));

		await mkdir(dirname(destination), { recursive: true });
		await cp(join(demo.root, "dist"), destination, { recursive: true });
	}

	const baseDemoPath = "components/base/";
	await mkdir(join(pagesDirectory, "components"), { recursive: true });
	await cp(join(repositoryDirectory, "dist/base-gallery"), join(pagesDirectory, baseDemoPath), { recursive: true });

	await buildSite({ repositoryDirectory, pagesDirectory, workspaceInventory, demos, baseDemoPath });
	await auditPageReferences(pagesDirectory);

	console.log(`Built ${demos.length} demos and the Base gallery in ${pagesDirectory}`);
}

function decodeHTMLAttribute(value) {
	const namedReferences = { amp: "&", apos: "'", gt: ">", lt: "<", quot: '"' };

	return value.replace(/&(?:#(x[\da-f]+|\d+)|(amp|apos|gt|lt|quot));/giu, (match, numeric, named) => {
		if (named) {
			return namedReferences[named.toLowerCase()];
		}

		const hexadecimal = numeric.toLowerCase().startsWith("x");
		const codePoint = Number.parseInt(hexadecimal ? numeric.slice(1) : numeric, hexadecimal ? 16 : 10);
		return codePoint <= 0x10ffff ? String.fromCodePoint(codePoint) : match;
	});
}

async function findHTMLFiles(directory) {
	const files = [];
	const entries = await readdir(directory, { withFileTypes: true });

	for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
		const entryPath = join(directory, entry.name);

		if (entry.isDirectory()) {
			files.push(...(await findHTMLFiles(entryPath)));
		} else if (entry.isFile() && entry.name.endsWith(".html")) {
			files.push(entryPath);
		}
	}

	return files;
}

function findPageReferences(html) {
	const references = [];
	const lowerHTML = html.toLowerCase();
	let position = 0;

	while (position < html.length) {
		const tagStart = html.indexOf("<", position);
		if (tagStart === -1) {
			break;
		}
		if (html.startsWith("<!--", tagStart)) {
			const commentEnd = html.indexOf("-->", tagStart + 4);
			position = commentEnd === -1 ? html.length : commentEnd + 3;
			continue;
		}

		const nameMatch = /^[a-z][\w:-]*/iu.exec(html.slice(tagStart + 1));
		if (!nameMatch) {
			position = findTagEnd(html, tagStart + 1) + 1;
			continue;
		}

		const tagName = nameMatch[0].toLowerCase();
		const attributesStart = tagStart + 1 + nameMatch[0].length;
		const tagEnd = findTagEnd(html, attributesStart);
		const attributes = html.slice(attributesStart, tagEnd);
		const attributePattern = /\s(?:href|src)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/giu;
		let attributeMatch;

		while ((attributeMatch = attributePattern.exec(attributes))) {
			references.push(attributeMatch[1] ?? attributeMatch[2] ?? attributeMatch[3]);
		}

		position = tagEnd + 1;
		if ((tagName === "script" || tagName === "style") && !attributes.trimEnd().endsWith("/")) {
			const closingTag = lowerHTML.indexOf(`</${tagName}`, position);
			position = closingTag === -1 ? html.length : closingTag;
		}
	}

	return references;
}

function findTagEnd(html, start) {
	let quote;

	for (let position = start; position < html.length; ++position) {
		const character = html[position];

		if (quote) {
			if (character === quote) {
				quote = undefined;
			}
		} else if (character === '"' || character === "'") {
			quote = character;
		} else if (character === ">") {
			return position;
		}
	}

	return html.length;
}

async function pageTargetExists(target) {
	let targetStats;
	try {
		targetStats = await stat(target);
	} catch (error) {
		if (error.code === "ENOENT" || error.code === "ENOTDIR") {
			return false;
		}

		throw error;
	}

	if (targetStats.isFile()) {
		return true;
	}
	if (!targetStats.isDirectory()) {
		return false;
	}

	try {
		return (await stat(join(target, "index.html"))).isFile();
	} catch (error) {
		if (error.code === "ENOENT" || error.code === "ENOTDIR") {
			return false;
		}

		throw error;
	}
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
	await buildPages();
}
