import { readFile, realpath } from "node:fs/promises";
import path from "node:path";

/** Canonicalize an existing path or an output whose parent directories do not exist yet. */
export async function canonicalPath(file) {
	const absolute = path.resolve(file);
	try {
		return await realpath(absolute);
	} catch (error) {
		if (error.code !== "ENOENT" && error.code !== "ENOTDIR") {
			throw error;
		}
		const parent = path.dirname(absolute);
		if (parent === absolute) {
			return absolute;
		}
		return path.join(await canonicalPath(parent), path.basename(absolute));
	}
}

/** Discover package boundaries from the compiler's actual reference graph. */
export async function readProjectPackages(projects) {
	const packages = new Map();
	for (const project of projects) {
		let directory = path.dirname(project.configFile);
		while (true) {
			try {
				const file = path.join(directory, "package.json");
				const manifest = JSON.parse(await readFile(file, "utf8"));
				if (typeof manifest.name === "string" && manifest.exports !== undefined) {
					const root = await canonicalPath(directory);
					const previous = packages.get(manifest.name);
					if (previous && previous.root !== root) {
						throw new Error(`Duplicate project package: ${manifest.name}`);
					}
					packages.set(manifest.name, { root, manifest, file });
				}
				break;
			} catch (error) {
				if (error.code !== "ENOENT") {
					throw error;
				}
			}
			const parent = path.dirname(directory);
			if (parent === directory) {
				break;
			}
			directory = parent;
		}
	}
	return packages;
}

/** Resolve only public exports of packages in the configured project graph. */
export async function resolveProjectExport(packages, specifier, conditions) {
	const name = specifier.startsWith("@") ? specifier.split("/").slice(0, 2).join("/") : specifier.split("/")[0];
	const pkg = packages.get(name);
	if (!pkg) {
		return null;
	}
	const subpath = specifier === name ? "." : `.${specifier.slice(name.length)}`;
	const exports = pkg.manifest.exports;
	let target;
	if (typeof exports === "object" && exports !== null && !Array.isArray(exports)) {
		const keys = Object.keys(exports);
		const subpaths = keys.filter((key) => key.startsWith("."));
		if (subpaths.length && subpaths.length !== keys.length) {
			throw new Error(`Mixed export keys in ${name}`);
		}
		if (subpaths.length) {
			if (Object.hasOwn(exports, subpath)) {
				target = selectTarget(exports[subpath], conditions);
			} else {
				const matches = subpaths
					.filter((key) => {
						const star = key.indexOf("*");
						return (
							star >= 0 &&
							subpath.startsWith(key.slice(0, star)) &&
							subpath.endsWith(key.slice(star + 1)) &&
							subpath.length >= key.length - 1
						);
					})
					.sort((a, b) => b.indexOf("*") - a.indexOf("*") || b.length - a.length);
				if (matches.length) {
					const key = matches[0];
					const star = key.indexOf("*");
					const replacement = subpath.slice(star, subpath.length - (key.length - star - 1));
					target = selectTarget(exports[key], conditions, replacement);
				}
			}
		} else if (subpath === ".") {
			target = selectTarget(exports, conditions);
		}
	} else if (subpath === ".") {
		target = selectTarget(exports, conditions);
	}
	if (target == null) {
		throw new Error(`Package subpath ${specifier} is not exported for ${[...conditions].join(", ")}`);
	}
	const id = await canonicalPath(path.resolve(pkg.root, target));
	const relative = path.relative(pkg.root, id);
	if (relative.startsWith("..") || path.isAbsolute(relative)) {
		throw new Error(`Export escapes package ${name}`);
	}
	return { id, moduleSideEffects: hasSideEffects(pkg.manifest.sideEffects, relative) };
}

function selectTarget(value, conditions, replacement) {
	if (value === null) {
		return null;
	}
	if (typeof value === "string") {
		const target = replacement === undefined ? value : value.replaceAll("*", replacement);
		if (!target.startsWith("./") || /\\|%2f|%5c/i.test(target)) {
			throw new Error(`Invalid export target: ${target}`);
		}
		const segments = decodeURIComponent(target.slice(2)).split("/");
		if (segments.some((part) => part === ".." || part === "." || part === "node_modules")) {
			throw new Error(`Invalid export target: ${target}`);
		}
		return target;
	}
	if (Array.isArray(value)) {
		let lastError;
		for (const candidate of value) {
			try {
				const result = selectTarget(candidate, conditions, replacement);
				if (result != null) {
					return result;
				}
			} catch (error) {
				lastError = error;
			}
		}
		if (lastError) {
			throw lastError;
		}
		return null;
	}
	if (typeof value === "object") {
		for (const [condition, candidate] of Object.entries(value)) {
			if (/^\d+$/.test(condition)) {
				throw new Error(`Invalid numeric export condition: ${condition}`);
			}
			if (condition === "default" || conditions.has(condition)) {
				const result = selectTarget(candidate, conditions, replacement);
				if (result !== undefined) {
					return result;
				}
			}
		}
		return undefined;
	}
	throw new Error(`Invalid export target: ${String(value)}`);
}

/** Preserve a package's explicit side-effect declarations for emitted modules. */
export function hasSideEffects(value, relativeFile) {
	if (typeof value === "boolean") {
		return value;
	}
	if (!Array.isArray(value)) {
		return true;
	}
	const file = relativeFile.split(path.sep).join("/");
	return value.some((pattern) => {
		const normalized = pattern.replace(/^\.\//, "");
		return path.matchesGlob(file, normalized.includes("/") ? normalized : `**/${normalized}`);
	});
}
