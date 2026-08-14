import type { InteractionResult } from "./.result.js";
import { aborted, completed, failed, isAbortError, settle } from "./.result.js";

/** Opens a file picker and resolves selected handles to `File` objects. */
export const openFiles = (options: OpenFilePickerOptions = {}): Promise<InteractionResult<File[]>> => {
	if (isNativeFilePickerAvailable()) {
		try {
			const files = showOpenFilePicker!(options).then((handles) =>
				Promise.all(handles.map((handle) => handle.getFile())),
			);

			return settle(files, isAbortError);
		} catch (error) {
			return Promise.resolve(failed(error));
		}
	}

	return openInputFiles(options);
};

/** Returns whether the native File System Access picker is exposed in the current secure context. */
export const isNativeFilePickerAvailable = (): boolean =>
	globalThis.isSecureContext && typeof showOpenFilePicker === "function";

const openInputFiles = (options: OpenFilePickerOptions): Promise<InteractionResult<File[]>> => {
	if (typeof document === "undefined") {
		return Promise.resolve(failed(new DOMException("A document is required to open files.", "NotSupportedError")));
	}

	return new Promise((resolve) => {
		const input = document.createElement("input");
		const controller = new AbortController();

		input.type = "file";
		input.hidden = true;
		input.multiple = options.multiple ?? false;
		input.accept = acceptString(options.types);

		const cleanup = (): void => {
			controller.abort();
			input.remove();
		};

		const complete = (): void => {
			const files = [...(input.files ?? [])];

			resolve(files.length > 0 ? completed(files) : aborted);
			cleanup();
		};

		const abort = (): void => {
			resolve(aborted);
			cleanup();
		};

		input.addEventListener("change", complete, { signal: controller.signal });
		input.addEventListener("cancel", abort, { signal: controller.signal });

		(document.body ?? document.documentElement).append(input);

		try {
			input.click();
		} catch (error) {
			resolve(failed(error));
			cleanup();
		}
	});
};

const acceptString = (types: readonly FilePickerAcceptType[] | undefined): string =>
	types
		?.flatMap((type) => Object.entries(type.accept).flatMap(([mimeType, extensions]) => [mimeType, ...extensions]))
		.join(",") ?? "";

type ShowOpenFilePicker = (options?: OpenFilePickerOptions) => Promise<FileSystemFileHandle[]>;

/** One native file picker filter. */
export interface FilePickerAcceptType {
	/** MIME types mapped to accepted file extensions. */
	readonly accept: Readonly<Record<string, readonly string[]>>;

	/** A human-readable description of the filter. */
	readonly description?: string;
}

/** Options shared by the native and input-backed open-file pickers. */
export interface OpenFilePickerOptions {
	/** Excludes an unrestricted file option when the native picker supports it. */
	readonly excludeAcceptAllOption?: boolean;

	/** Remembers the native picker's last directory for this identifier. */
	readonly id?: string;

	/** Allows selecting more than one file. */
	readonly multiple?: boolean;

	/** Selects the native picker's initial directory. */
	readonly startIn?: WellKnownDirectory | FileSystemHandle;

	/** Restricts the file types displayed by the picker. */
	readonly types?: readonly FilePickerAcceptType[];
}

/** Native well-known starting directories. */
export type WellKnownDirectory = "desktop" | "documents" | "downloads" | "music" | "pictures" | "videos";

declare var showOpenFilePicker: ShowOpenFilePicker | undefined;
