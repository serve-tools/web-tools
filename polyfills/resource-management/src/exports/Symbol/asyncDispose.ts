/// <reference lib="esnext.disposable" preserve="true" />

import { asyncDispose as _asyncDispose } from "@serve-tools/ponyfill-resource-management/lib/Symbol/asyncDispose";

/** The native `Symbol.asyncDispose` when available, otherwise a module-scoped fallback symbol. */
export const asyncDispose: SymbolConstructor["asyncDispose"] = Symbol.asyncDispose ?? _asyncDispose;
