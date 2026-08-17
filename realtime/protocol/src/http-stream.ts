/** The media type for one unframed Serve Tools realtime HTTP message. */
export const contentType = "application/vnd.serve-tools.realtime.v1";

/** The media type for a stream of length-prefixed Serve Tools realtime messages. */
export const streamContentType = `${contentType};framing=length-prefixed`;

/** Returns whether `Content-Type` identifies one unframed Serve Tools realtime message. */
export const isContentType = (value: string | null): boolean => matchesContentType(value, false);

/** Returns whether `Content-Type` identifies a length-prefixed Serve Tools realtime message stream. */
export const isStreamContentType = (value: string | null): boolean => matchesContentType(value, true);

/** Returns whether `Accept` explicitly permits the requested Serve Tools realtime representation. */
export function acceptsContentType(value: string | null, stream = false): boolean {
	if (!value) {
		return false;
	}

	for (const entry of split(value, ",")) {
		const parsed = parseMediaType(entry, true);

		if (!parsed || parsed.type !== contentType || parsed.quality === 0) {
			continue;
		}

		const framing = parsed.parameters.get("framing");

		if (
			parsed.parameters.size === (stream ? 1 : 0) &&
			(stream ? framing === "length-prefixed" : framing === undefined)
		) {
			return true;
		}
	}

	return false;
}

const matchesContentType = (value: string | null, stream: boolean): boolean => {
	if (!value) {
		return false;
	}

	const parsed = parseMediaType(value, false);

	if (!parsed || parsed.type !== contentType) {
		return false;
	}

	const framing = parsed.parameters.get("framing");

	return parsed.parameters.size === (stream ? 1 : 0) && (stream ? framing === "length-prefixed" : true);
};

const parseMediaType = (value: string, accept: boolean): ParsedMediaType | undefined => {
	const [rawType = "", ...rawParameters] = split(value, ";");
	const type = rawType.trim().toLowerCase();

	if (!type.includes("/")) {
		return;
	}

	const parameters = new Map<string, string>();
	let hasQuality = false;
	let quality = 1;

	for (const rawParameter of rawParameters) {
		const separator = rawParameter.indexOf("=");

		if (separator < 1) {
			return;
		}

		const name = rawParameter.slice(0, separator).trim().toLowerCase();
		const raw = rawParameter.slice(separator + 1).trim();
		const parameter = raw.startsWith('"') && raw.endsWith('"') ? raw.slice(1, -1) : raw;

		if (!name || !parameter || parameters.has(name)) {
			return;
		}
		if (accept && name === "q") {
			if (hasQuality || !/^(?:0(?:\.\d{0,3})?|1(?:\.0{0,3})?)$/.test(parameter)) {
				return;
			}

			hasQuality = true;
			quality = Number(parameter);
			continue;
		}

		parameters.set(name, parameter);
	}

	return { parameters, quality, type };
};

const split = (value: string, separator: string): string[] => {
	const entries: string[] = [];
	let quoted = false;
	let escaped = false;
	let start = 0;

	for (let index = 0; index < value.length; ++index) {
		const character = value[index];

		if (escaped) {
			escaped = false;
		} else if (quoted && character === "\\") {
			escaped = true;
		} else if (character === '"') {
			quoted = !quoted;
		} else if (!quoted && character === separator) {
			entries.push(value.slice(start, index));
			start = index + 1;
		}
	}

	entries.push(value.slice(start));

	return entries;
};

interface ParsedMediaType {
	readonly parameters: Map<string, string>;
	readonly quality: number;
	readonly type: string;
}
