const components = ["protocol", "username", "password", "hostname", "port", "pathname", "search", "hash"] as const;

type Component = (typeof components)[number];
type ComponentValues = Record<Component, string>;
type ComponentIndex = number;

const protocolIndex = 0;
const usernameIndex = 1;
const passwordIndex = 2;
const hostnameIndex = 3;
const portIndex = 4;
const pathnameIndex = 5;

const escape = (value: string): string => value.replace(/[\\^$.*+?()[\]{}|]/g, "\\$&");

const invalidPattern = (): never => {
	throw new TypeError("Invalid URL pattern");
};

const normalize = (component: ComponentIndex, value: string): string => {
	if (component === protocolIndex) {
		if (/[^\u0020-\u007F]/.test(value) && value[0] !== ":") {
			invalidPattern();
		}

		return value.replace(/:$/, "").toLowerCase();
	}

	if (component > pathnameIndex) {
		value = value.replace(/^[?#]/, "");
	}

	if (component === hostnameIndex) {
		value = value.replace(/[\t\n\r]/g, "").split(/\/(?![^()]*\))|#|\\[\\?]/, 1)[0]!;

		if (value.includes("\\:") && !value.includes("[")) {
			invalidPattern();
		}

		if (/[\s%<>@^|\]]/.test(value) && !/^\{?\[/.test(value)) {
			invalidPattern();
		}

		return value
			.toLowerCase()
			.replace(/[^.]*[^\u0020-\u007F][^.]*/g, (part) =>
				part.includes(":") ? part : new URL(`http://${part}`).hostname,
			);
	}

	if (component !== portIndex) {
		if (/[^\u0020-\u007F]| /.test(value)) {
			value = value.toWellFormed();
			value = value.replace(/[^\u0020-\u007F]| /gu, (character, offset: number) =>
				/:[\p{ID_Start}\p{ID_Continue}_$]*$/u.test(value.slice(0, offset))
					? character
					: encodeURIComponent(character),
			);
		}

		return component === pathnameIndex &&
			value[0] === "/" &&
			value.includes(".") &&
			/(?:^|\/)\.{1,2}(?:\/|$)/.test(value)
			? new URL(value, "http://a").pathname
			: value;
	}

	return value;
};

const valuesFromURL = (url: URL): ComponentValues => ({
	protocol: url.protocol.slice(0, -1),
	username: url.username,
	password: url.password,
	hostname: url.hostname,
	port: url.port,
	pathname: url.pathname,
	search: url.search.slice(1),
	hash: url.hash.slice(1),
});

const parseObject = (input: URLPatternInit, pattern: boolean): ComponentValues => {
	const base = input.baseURL === undefined ? undefined : new URL(input.baseURL);
	const result = base ? valuesFromURL(base) : ({} as ComponentValues);

	let inherited = base !== undefined;

	for (let index = 0; index < components.length; ++index) {
		const component = components[index]!;
		const value = input[component];

		if (value !== undefined) {
			let source = String(value);

			if (index === pathnameIndex && !pattern && /[{}]/.test(source)) {
				source = source.replace(/[{}]/g, encodeURIComponent);
			}

			if (pattern && /[({]/.test(source)) {
				if (/\([^)]*[^\u0020-\u007F]|\{[^}]*\{/.test(source)) {
					invalidPattern();
				}

				source = source.replace(/(^|[/?])\(\.\*\)/g, "$1*").replace(/\{([^{}:*()\\]+)\}(?![?*+])/g, "$1");
			}

			result[component] =
				index === pathnameIndex &&
				(result.protocol === "data" ||
					(result.protocol.includes("javascript") && !result.protocol.includes("https")))
					? source.toWellFormed()
					: normalize(index, source);

			if (index !== usernameIndex && index !== passwordIndex) {
				inherited = false;
			}
		} else if (pattern && (index === usernameIndex || index === passwordIndex)) {
			result[component] = "*";
		} else if (base && inherited) {
			const inheritedValue = result[component];

			result[component] =
				pattern && index >= pathnameIndex ? inheritedValue.replace(/[\\:*+?{}()]/g, "\\$&") : inheritedValue;
		} else {
			result[component] = pattern ? "*" : "";
		}
	}

	if (base && input.pathname !== undefined) {
		const pathname = result.pathname.replace(/^\\\//, "/");

		result.pathname = normalize(
			pathnameIndex,
			pathname[0] === "/" ? pathname : `${base.pathname.slice(0, base.pathname.lastIndexOf("/") + 1)}${pathname}`,
		);
	}

	if (base && !pattern) {
		const resetCredentials = input.hostname !== undefined || input.port !== undefined;

		if (resetCredentials && input.username === undefined) {
			result.username = "";
		}

		if ((resetCredentials || input.username !== undefined) && input.password === undefined) {
			result.password = "";
		}
	}

	const hostname = result.hostname;

	if (
		hostname.includes("[") &&
		(!/\]\}?$/.test(hostname) ||
			/[^a-f\d:[\]{}*?.\\]/i.test(hostname.replace(/(?<!\\):[\p{ID_Start}_$][\p{ID_Continue}$]*/gu, ":")))
	) {
		invalidPattern();
	}

	let port = result.port;

	if (port && !/[(*:{]/.test(port)) {
		if (!pattern) {
			if (!/^\d/.test(port)) {
				invalidPattern();
			}

			port = port.replace(/[\t\n\r]/g, "").match(/^\d*/)![0]!;
		} else {
			port = port.trim();
		}

		if (!/^\d*$/.test(port) || Number(port) > 65535) {
			invalidPattern();
		}
	}

	const protocol = result.protocol;

	if (protocol && !/[:*({]/.test(protocol) && port && /^\d*$/.test(port) && (!pattern || input.port === port)) {
		port = new URL(`${protocol}://a:${port}`).port;
	}

	result.port = port;

	return result;
};

const parsePattern = (input: string, baseURL?: string): ComponentValues => {
	const escapedProtocol = /^[A-Za-z][\w+.-]*\\:/.test(input);

	if (escapedProtocol) {
		input = input.replace("\\:", ":");
		input = input.replace(/^(https?|wss?|ftp):(?=[^/])/, "$1://");
	}

	if (baseURL !== undefined) {
		input = input.replace(/\{\\:\}/g, "\\:");
	}

	const specialPattern = /[({?\p{Cc}]/u.test(input);

	if (specialPattern) {
		const authorityIndex = input.indexOf("://");

		if (authorityIndex >= 0) {
			input =
				input.slice(0, authorityIndex + 3) +
				input.slice(authorityIndex + 3).replace(/\{([^{}]*)\/\}[^/?#]*/g, "$1");
		}

		input = input.replace(/\((?:[^()]|\([^()]*\))*\)/g, (group) =>
			group.replaceAll("?", "\u0001").replaceAll("/", "\u0003"),
		);

		input = input
			.replace(/\\\?/g, "\u0002")
			.replace(/([})*]|:[\p{ID_Start}_$][\p{ID_Continue}$]*)\?/gu, "$1\u0001")
			.replaceAll("\u0002", "?");
	}

	const matched = /^(?:([^:/\\]+):(?:\/\/([^/?#]*))?)?([^?#]*)(?:\?([^#]*))?(?:#(.*))?$/.exec(input)!;
	const absolute = matched[1] !== undefined;

	if (baseURL === undefined) {
		if (!absolute) {
			invalidPattern();
		}
	} else if (absolute) {
		new URL(baseURL);
	}

	const [, protocol, authority, rawPathname, search, hash] =
		absolute && specialPattern
			? matched.map((value) => value?.replaceAll("\u0001", "?").replaceAll("\u0003", "/"))
			: matched;

	if (absolute && authority === undefined && !escapedProtocol && rawPathname && !rawPathname.includes("*")) {
		invalidPattern();
	}

	const values: URLPatternInit = absolute ? { protocol, hostname: "", port: "" } : { baseURL: baseURL! };

	if (rawPathname || (absolute && (search !== undefined || hash !== undefined || authority === undefined))) {
		values.pathname = rawPathname || (authority === undefined ? "" : "/");
	}

	if (authority !== undefined) {
		const at = authority.lastIndexOf("@");
		const host = authority.slice(at + 1);

		if (at >= 0) {
			const credentials = authority
				.slice(0, at)
				.replace(/\{\\:\}/g, "%3A")
				.replace(/\\:/g, ":");
			const colon = credentials.includes("::") ? credentials.indexOf("::") : credentials.indexOf(":");

			values.username = colon < 0 ? credentials : credentials.slice(0, colon);

			if (colon >= 0) {
				values.password = credentials.slice(colon + 1);
			}
		}

		const [, hostname, port = ""] = /^(.*?)(?::(\d*))?$/s.exec(host)!;

		values.hostname = hostname;
		values.port = port;
	}

	if (search !== undefined) {
		values.search = search;
	} else if (absolute && hash !== undefined) {
		values.search = "";
	}

	if (hash !== undefined) {
		values.hash = hash;
	}

	return parseObject(values, true);
};

type CompiledComponent = string | [regex: RegExp, names: string[], custom: boolean];

const compile = (
	pattern: string,
	component: ComponentIndex,
	ignoreCase: boolean,
	values: ComponentValues,
): CompiledComponent => {
	if (!pattern || (!ignoreCase && !/[\\:*({}?+]/.test(pattern))) {
		return pattern;
	}

	let source = "";
	let unnamed = 0;
	let custom = false;

	const names: string[] = [];
	const delimiter = component === pathnameIndex ? "/" : component === hostnameIndex ? "." : "";
	const segment = delimiter ? `[^\\${delimiter}]+?` : ".+?";

	for (let index = 0; index < pattern.length; ++index) {
		const character = pattern[index]!;

		if (character === "\\") {
			if (++index === pattern.length) {
				invalidPattern();
			}

			let literal = pattern[index]!;

			if (component === pathnameIndex && /[{}.]/.test(literal)) {
				literal = literal === "." ? literal : encodeURIComponent(literal);
				pattern = pattern.slice(0, index - 1) + literal + pattern.slice(index + 1);

				values.pathname = pattern;

				index += literal.length - 2;
			}

			source += escape(literal);

			continue;
		}

		if (character === "{") {
			source += "(?:";

			continue;
		}

		if (character === "}") {
			source += ")";

			if ("?*+".includes(pattern[index + 1]!)) {
				source += pattern[++index];
			}

			continue;
		}

		if (character !== ":" && character !== "*" && character !== "(") {
			if (character === "?" || character === "+") {
				invalidPattern();
			}

			source += escape(character);

			continue;
		}

		let name: string;
		let capture: string;

		if (character === ":") {
			const match = /^[\p{ID_Start}_$][\p{ID_Continue}$]*/u.exec(pattern.slice(index + 1));

			if (!match) {
				invalidPattern();
			}

			name = match![0];
			index += name.length;
			capture = segment;
		} else {
			name = String(unnamed++);
			capture = ".*";
		}

		if (character === "(" || pattern[index + 1] === "(") {
			let depth = 1;
			let end = character === "(" ? index + 1 : index + 2;

			const start = end;

			while (end < pattern.length && depth) {
				if (pattern[end] === "\\") {
					++end;
				} else if (pattern[end] === "(") {
					++depth;
				} else if (pattern[end] === ")") {
					--depth;
				}

				++end;
			}

			if (depth) {
				invalidPattern();
			}

			capture = pattern.slice(start, end - 1);
			custom ||= capture !== ".*" && (!delimiter || capture !== segment);

			if (/(^|[^\\])\((?!\?)/.test(capture)) {
				invalidPattern();
			}

			index = end - 1;
		}

		if (names.includes(name)) {
			invalidPattern();
		}

		names.push(name);

		let group = `(${capture})`;

		const modifier = pattern[index + 1];

		if ("?*+".includes(modifier!)) {
			++index;

			if (modifier !== "?") {
				group = `(${capture}(?:${escape(delimiter)}${capture})*)`;
			}

			if (modifier !== "+") {
				const followsSegment = !pattern[index + 1] || pattern[index + 1] === delimiter;
				const prefix =
					delimiter && followsSegment && source.endsWith(escape(delimiter)) ? escape(delimiter) : "";

				if (prefix) {
					source = source.slice(0, -prefix.length);
				}

				group = `(?:${prefix}${group})?`;
			}
		}

		source += group;
	}

	try {
		return [new RegExp(`^${source}$`, ignoreCase ? "iv" : "v"), names, custom];
	} catch {
		return invalidPattern();
	}
};

export class URLPattern {
	declare readonly protocol: string;
	declare readonly username: string;
	declare readonly password: string;
	declare readonly hostname: string;
	declare readonly port: string;
	declare readonly pathname: string;
	declare readonly search: string;
	declare readonly hash: string;
	declare readonly hasRegExpGroups: boolean;

	#compiled: Partial<Record<Component, CompiledComponent>>;

	constructor(input?: URLPatternInput, options?: URLPatternOptions);
	constructor(input: string, baseURL: string, options?: URLPatternOptions);
	constructor(
		input: URLPatternInput = {},
		baseURLOrOptions?: string | URLPatternOptions,
		options?: URLPatternOptions,
	) {
		const stringInput = typeof input === "string";
		const stringBaseURL = typeof baseURLOrOptions === "string";

		if (!stringInput && (typeof input !== "object" || input === null || stringBaseURL)) {
			invalidPattern();
		}

		const settings = stringBaseURL ? options : baseURLOrOptions;
		const values = stringInput
			? parsePattern(input, stringBaseURL ? baseURLOrOptions : undefined)
			: parseObject(input, true);
		const compiled: Partial<Record<Component, CompiledComponent>> = {};

		let hasRegExpGroups = false;

		for (let index = 0; index < components.length; ++index) {
			const component = components[index]!;
			const value = values[component];

			if (value !== "*") {
				const result = compile(value, index, settings?.ignoreCase === true, values);

				compiled[component] = result;

				hasRegExpGroups ||= typeof result !== "string" && result[2];
			}
		}

		if (/[{\\]/.test(values.pathname) && !compiled.pathname?.[2]) {
			values.pathname = values.pathname
				.replaceAll("{(.*)}", "(.*)")
				.replace(
					/\(\.\*\)(?=[^}]*\})|(?<!\/)\{(:[\p{ID_Continue}$]+)\}(?=[:?*]|\{(?:\\.|[^}\\])*[:*(])/gu,
					(_, name: string | undefined) => name ?? "*",
				)
				.replace(/(?<![{/])(\/?:[\p{ID_Continue}$]+)(?:\\(?=[\p{ID_Continue}$])|\{\}\??)/gu, "{$1}")
				.replaceAll("*{}**?", "*(.*)?")
				.replaceAll("*\\/*", "*/{*}");
		}

		Object.assign(this, values);

		this.#compiled = compiled;
		this.hasRegExpGroups = hasRegExpGroups;
	}

	test(input: URLPatternInput = {}, baseURL?: string): boolean {
		const values = this.#values(input, baseURL);

		if (!values) {
			return false;
		}

		for (const name in this.#compiled) {
			const component = name as Component;
			const compiled = this.#compiled[component]!;

			if (typeof compiled === "string" ? compiled !== values[component] : !compiled[0].test(values[component])) {
				return false;
			}
		}

		return true;
	}

	exec(input: URLPatternInput = {}, baseURL?: string): URLPatternResult | null {
		const values = this.#values(input, baseURL);

		if (!values) {
			return null;
		}

		const matches: Partial<Record<Component, RegExpExecArray>> = {};

		for (const name in this.#compiled) {
			const component = name as Component;
			const compiled = this.#compiled[component]!;
			const value = values[component];

			if (typeof compiled !== "string") {
				const match = compiled[0].exec(value);

				if (!match) {
					return null;
				}

				matches[component] = match;
			} else if (compiled !== value) {
				return null;
			}
		}

		const result = {
			inputs: baseURL === undefined ? [input ?? {}] : [input, baseURL],
		} as URLPatternResult;

		for (const component of components) {
			const compiled = this.#compiled[component];
			const value = values[component];
			const groups: Record<string, string | undefined> = {};

			if (compiled === undefined) {
				groups[0] = value;
			} else if (typeof compiled !== "string") {
				const match = matches[component]!;

				for (let index = 0; index < compiled[1].length; ++index) {
					Object.defineProperty(groups, compiled[1][index]!, {
						value: match[index + 1],
						configurable: true,
						enumerable: true,
						writable: true,
					});
				}
			}

			result[component] = { input: value, groups };
		}

		return result;
	}

	#values(input: URLPatternInput, baseURL?: string): ComponentValues | null {
		if (typeof input !== "string" && baseURL !== undefined) {
			invalidPattern();
		}

		try {
			if (typeof input !== "string") {
				return parseObject(input ?? {}, false);
			}

			if (baseURL === undefined && input[0] === "/") {
				return parseObject({ pathname: input }, false);
			}

			return valuesFromURL(new URL(input, baseURL));
		} catch {
			return null;
		}
	}
}

export type URLPatternInput = string | URLPatternInit;

export interface URLPatternOptions {
	ignoreCase?: boolean;
}

export interface URLPatternInit {
	protocol?: string;
	username?: string;
	password?: string;
	hostname?: string;
	port?: string;
	pathname?: string;
	search?: string;
	hash?: string;
	baseURL?: string;
}

export interface URLPatternResult {
	inputs: URLPatternInput[];
	protocol: URLPatternComponentResult;
	username: URLPatternComponentResult;
	password: URLPatternComponentResult;
	hostname: URLPatternComponentResult;
	port: URLPatternComponentResult;
	pathname: URLPatternComponentResult;
	search: URLPatternComponentResult;
	hash: URLPatternComponentResult;
}

export interface URLPatternComponentResult {
	input: string;
	groups: Record<string, string | undefined>;
}
