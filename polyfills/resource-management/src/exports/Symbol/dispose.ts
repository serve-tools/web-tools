/// <reference lib="esnext.disposable" preserve="true" />

import { dispose as _dispose } from "@serve-tools/ponyfill-resource-management/lib/Symbol/dispose";

/** The native `Symbol.dispose` when available, otherwise a module-scoped fallback symbol. */
export const dispose: SymbolConstructor["dispose"] = Symbol.dispose || _dispose;
