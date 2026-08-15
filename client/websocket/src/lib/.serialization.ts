type Ref = number;

const protocol = "@serve-tools/structured-serialization/1";
const hole = -2;
// biome-ignore lint/suspicious/noSparseArray: indices align sentinel references with their decoded values
const sentinels = [, undefined, undefined, Number.NaN, Infinity, -Infinity, -0];
const errorNames = "Error,EvalError,RangeError,ReferenceError,SyntaxError,TypeError,URIError".split(",");
const viewNames = (
	"Int8Array,Uint8Array,Uint8ClampedArray,Int16Array,Uint16Array,Int32Array,Uint32Array," +
	"Float16Array,Float32Array,Float64Array,BigInt64Array,BigUint64Array"
).split(",");

const arrayBufferByteLength = Object.getOwnPropertyDescriptor(ArrayBuffer.prototype, "byteLength")!.get!;
const arrayBufferDetached = Object.getOwnPropertyDescriptor(ArrayBuffer.prototype, "detached")?.get;
const arrayBufferMaxByteLength = Object.getOwnPropertyDescriptor(ArrayBuffer.prototype, "maxByteLength")?.get;
const arrayBufferResizable = Object.getOwnPropertyDescriptor(ArrayBuffer.prototype, "resizable")?.get;
const dataViewByteLength = Object.getOwnPropertyDescriptor(DataView.prototype, "byteLength")!.get!;
const objectPrototype = Object.prototype;
const regexpSource = Object.getOwnPropertyDescriptor(RegExp.prototype, "source")!.get!;
const typedArrayName = Object.getOwnPropertyDescriptor(
	Object.getPrototypeOf(Uint8Array.prototype) as object,
	Symbol.toStringTag,
)!.get!;
const textDecoder = new TextDecoder("utf-8", { fatal: true });
const textEncoder = new TextEncoder();

const die = (): never => {
	throw new DOMException("The value could not be cloned", "DataCloneError");
};

/** Serializes one structured-clone-compatible value into the package's binary wire format. */
export function serialize(root: unknown): ArrayBuffer {
	const buffers: Uint8Array[] = [];
	const table: unknown[] = [];
	const memo = new Map<unknown, Ref>();

	let binaryLength = 0;

	const visit = (value: unknown): Ref => {
		if (value === undefined) return -1;

		if (typeof value === "number") {
			if (Number.isNaN(value)) return -3;
			if (value === Infinity) return -4;
			if (value === -Infinity) return -5;
			if (Object.is(value, -0)) return -6;
		}

		let ref = memo.get(value);

		if (ref !== undefined) return ref;

		memo.set(value, (ref = table.length));
		table.push(0);
		table[ref] = encode(value);

		return ref;
	};

	const record = (value: Record<string, unknown>): Record<string, Ref> => {
		const entry: Record<string, Ref> = Object.create(null) as Record<string, Ref>;

		for (const key of Object.keys(value)) entry[key] = visit(value[key]);

		return entry;
	};

	const encode = (value: unknown): unknown => {
		switch (typeof value) {
			case "string":
			case "boolean":
			case "number":
				return value;
			case "bigint":
				return ["B", String(value)];
			case "function":
			case "symbol":
				return die();
		}

		if (value === null) return null;

		if (Array.isArray(value)) {
			const refs: Ref[] = new Array(value.length);

			for (let index = 0; index < value.length; ++index)
				refs[index] = index in value ? visit(value[index]) : hole;

			return refs;
		}

		if (ArrayBuffer.isView(value)) {
			const view = value as ArrayBufferView;

			try {
				dataViewByteLength.call(value);

				return ["V", visit(view.buffer), view.byteOffset, view.byteLength];
			} catch {}

			const name = typedArrayName.call(value) as string;
			const type = viewNames.indexOf(name);

			if (type < 0) return die();

			return [
				"T",
				type,
				visit(view.buffer),
				view.byteOffset,
				(value as unknown as { readonly length: number }).length,
			];
		}

		const object = value as Record<string, unknown>;

		if (Object.getPrototypeOf(object) === objectPrototype) return record(object);

		const tag = objectPrototype.toString.call(object).slice(8, -1);

		switch (tag) {
			case "Date": {
				try {
					const time = Date.prototype.getTime.call(value);

					return ["D", Number.isNaN(time) ? "x" : time];
				} catch {
					return record(object);
				}
			}
			case "RegExp": {
				try {
					return ["R", regexpSource.call(value), (value as RegExp).flags];
				} catch {
					return record(object);
				}
			}
			case "ArrayBuffer": {
				try {
					const byteLength = arrayBufferByteLength.call(value) as number;

					if (arrayBufferDetached?.call(value)) return die();

					const offset = binaryLength;
					const bytes = new Uint8Array(value as ArrayBuffer);

					buffers.push(bytes);
					binaryLength += byteLength;

					return arrayBufferResizable?.call(value)
						? ["A", offset, byteLength, arrayBufferMaxByteLength!.call(value)]
						: ["A", offset, byteLength];
				} catch (error) {
					if (error instanceof DOMException && error.name === "DataCloneError") throw error;

					return record(object);
				}
			}
			case "Map": {
				let entries: MapIterator<[unknown, unknown]>;

				try {
					entries = Map.prototype.entries.call(value);
				} catch {
					return record(object);
				}

				const entry: unknown[] = ["M"];

				for (const [key, item] of entries) entry.push(visit(key), visit(item));

				return entry;
			}
			case "Set": {
				let values: SetIterator<unknown>;

				try {
					values = Set.prototype.values.call(value);
				} catch {
					return record(object);
				}

				const entry: unknown[] = ["S"];

				for (const item of values) entry.push(visit(item));

				return entry;
			}
			case "Boolean":
				try {
					return ["O", visit(Boolean.prototype.valueOf.call(value))];
				} catch {
					return record(object);
				}
			case "Number":
				try {
					return ["O", visit(Number.prototype.valueOf.call(value))];
				} catch {
					return record(object);
				}
			case "String":
				try {
					return ["O", visit(String.prototype.valueOf.call(value))];
				} catch {
					return record(object);
				}
			case "BigInt":
				try {
					return ["O", visit(BigInt.prototype.valueOf.call(value))];
				} catch {
					return record(object);
				}
			case "Error": {
				const error = value as Error & { readonly cause?: unknown; readonly errors?: unknown };
				const aggregate = error.name === "AggregateError" && "errors" in error;
				const entry: unknown[] = aggregate
					? ["G", error.message, visit(error.errors)]
					: ["E", Math.max(0, errorNames.indexOf(error.name)), error.message];

				if (Object.hasOwn(error, "cause")) entry.push(visit(error.cause));

				return entry;
			}
			case "SharedArrayBuffer":
				return die();
			case "Object":
				return record(object);
			default:
				return die();
		}
	};

	const rootRef = visit(root);
	const metadata = textEncoder.encode(JSON.stringify([protocol, rootRef, table]));
	const output = new Uint8Array(metadata.length + 1 + binaryLength);

	output.set(metadata);

	let offset = metadata.length + 1;

	for (const buffer of buffers) {
		output.set(buffer, offset);
		offset += buffer.byteLength;
	}

	return output.buffer;
}

/** Deserializes one value from the package's binary wire format. */
export function deserialize(payload: ArrayBuffer | ArrayBufferView): unknown {
	try {
		const bytes = ArrayBuffer.isView(payload)
			? new Uint8Array(payload.buffer, payload.byteOffset, payload.byteLength)
			: new Uint8Array(payload);
		const delimiter = bytes.indexOf(0);

		if (delimiter < 0) return die();

		const metadata = JSON.parse(textDecoder.decode(bytes.subarray(0, delimiter))) as unknown;

		if (!Array.isArray(metadata) || metadata.length !== 3 || metadata[0] !== protocol) return die();

		const rootRef = metadata[1];
		const table = metadata[2];

		if (!Array.isArray(table)) return die();

		const binaryOffset = delimiter + 1;
		const output: unknown[] = new Array(table.length);

		const define = (object: object, key: PropertyKey, value: unknown, enumerable = false): void => {
			Object.defineProperty(object, key, { value, enumerable, writable: true, configurable: true });
		};

		const deref = (ref: unknown): unknown => {
			if (typeof ref !== "number" || !Number.isSafeInteger(ref)) return die();
			if (ref < 0) return ref === -1 || (ref <= -3 && ref >= -6) ? sentinels[-ref] : die();
			if (ref >= table.length) return die();

			return ref in output ? output[ref] : hydrate(ref);
		};

		const tagged = (index: number, entry: unknown[]): unknown => {
			const tag = entry[0];

			switch (tag) {
				case "B":
					if (entry.length !== 2 || typeof entry[1] !== "string") return die();

					return (output[index] = BigInt(entry[1]));
				case "D":
					if (entry.length !== 2 || (entry[1] !== "x" && typeof entry[1] !== "number")) return die();

					return (output[index] = new Date(entry[1] === "x" ? Number.NaN : entry[1]));
				case "R":
					if (entry.length !== 3 || typeof entry[1] !== "string" || typeof entry[2] !== "string")
						return die();

					return (output[index] = new RegExp(entry[1], entry[2]));
				case "A": {
					if (
						(entry.length !== 3 && entry.length !== 4) ||
						!isSize(entry[1]) ||
						!isSize(entry[2]) ||
						(entry.length === 4 && (!isSize(entry[3]) || entry[3] < entry[2])) ||
						entry[1] + entry[2] > bytes.length - binaryOffset
					) {
						return die();
					}

					const buffer =
						entry.length === 4
							? new ArrayBuffer(entry[2], { maxByteLength: entry[3] as number })
							: new ArrayBuffer(entry[2]);

					new Uint8Array(buffer).set(
						bytes.subarray(binaryOffset + entry[1], binaryOffset + entry[1] + entry[2]),
					);

					return (output[index] = buffer);
				}
				case "T": {
					if (
						entry.length !== 5 ||
						!isSize(entry[1]) ||
						entry[1] >= viewNames.length ||
						!isSize(entry[3]) ||
						!isSize(entry[4])
					) {
						return die();
					}

					const Constructor = (globalThis as Record<string, unknown>)[viewNames[entry[1]]];

					if (typeof Constructor !== "function") return die();

					return (output[index] = new (Constructor as TypedArrayConstructor)(
						deref(entry[2]) as ArrayBuffer,
						entry[3],
						entry[4],
					));
				}
				case "V":
					if (entry.length !== 4 || !isSize(entry[2]) || !isSize(entry[3])) return die();

					return (output[index] = new DataView(deref(entry[1]) as ArrayBuffer, entry[2], entry[3]));
				case "M": {
					if (entry.length % 2 === 0) return die();

					const map = new Map();

					output[index] = map;

					for (let item = 1; item < entry.length; item += 2)
						map.set(deref(entry[item]), deref(entry[item + 1]));

					return map;
				}
				case "S": {
					const set = new Set();

					output[index] = set;

					for (let item = 1; item < entry.length; ++item) set.add(deref(entry[item]));

					return set;
				}
				case "O":
					if (entry.length !== 2) return die();

					return (output[index] = Object(deref(entry[1])));
				case "G": {
					if ((entry.length !== 3 && entry.length !== 4) || typeof entry[1] !== "string") return die();

					const error = new AggregateError([], entry[1]);

					output[index] = error;

					const errors = deref(entry[2]);

					if (!Array.isArray(errors)) return die();

					define(error, "errors", errors);
					if (entry.length === 4) define(error, "cause", deref(entry[3]));

					return error;
				}
				case "E": {
					if (
						(entry.length !== 3 && entry.length !== 4) ||
						!isSize(entry[1]) ||
						entry[1] >= errorNames.length ||
						typeof entry[2] !== "string"
					) {
						return die();
					}

					const ErrorType = (globalThis as Record<string, unknown>)[errorNames[entry[1]]];

					if (typeof ErrorType !== "function") return die();

					const error = new (ErrorType as ErrorConstructor)(entry[2]);

					output[index] = error;
					if (entry.length === 4) define(error, "cause", deref(entry[3]));

					return error;
				}
				default:
					return die();
			}
		};

		const hydrate = (index: number): unknown => {
			const entry = table[index];

			if (entry === null || typeof entry !== "object") return (output[index] = entry);

			if (Array.isArray(entry)) {
				if (typeof entry[0] === "string") return tagged(index, entry);

				const array: unknown[] = new Array(entry.length);

				output[index] = array;

				for (let item = 0; item < entry.length; ++item) {
					if (entry[item] !== hole) array[item] = deref(entry[item]);
				}

				return array;
			}

			const object: Record<string, unknown> = {};

			output[index] = object;

			for (const key of Object.keys(entry)) {
				const value = deref((entry as Record<string, unknown>)[key]);

				if (key === "__proto__") define(object, key, value, true);
				else object[key] = value;
			}

			return object;
		};

		return deref(rootRef);
	} catch (error) {
		if (error instanceof DOMException && error.name === "DataCloneError") throw error;

		return die();
	}
}

const isSize = (value: unknown): value is number =>
	typeof value === "number" && Number.isSafeInteger(value) && value >= 0;

interface TypedArrayConstructor {
	new (buffer: ArrayBuffer, byteOffset: number, length: number): ArrayBufferView;
}
