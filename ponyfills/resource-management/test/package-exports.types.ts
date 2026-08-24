import type { AsyncDisposable } from "@serve-tools/ponyfill-resource-management/lib/AsyncDisposable";
import type { AsyncDisposableStack } from "@serve-tools/ponyfill-resource-management/lib/AsyncDisposableStack";
import type { Disposable } from "@serve-tools/ponyfill-resource-management/lib/Disposable";
import type { DisposableStack } from "@serve-tools/ponyfill-resource-management/lib/DisposableStack";
import type { SuppressedError } from "@serve-tools/ponyfill-resource-management/lib/SuppressedError";

void (0 as unknown as AsyncDisposable);
void (0 as unknown as AsyncDisposableStack);
void (0 as unknown as Disposable);
void (0 as unknown as DisposableStack);
void (0 as unknown as SuppressedError);

// @ts-expect-error Internal modules are deliberately not package entrypoints.
type InternalModule = typeof import("@serve-tools/ponyfill-resource-management/lib/.internals");

void (0 as unknown as InternalModule);
