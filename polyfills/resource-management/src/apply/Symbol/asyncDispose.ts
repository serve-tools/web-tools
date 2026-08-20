/// <reference lib="esnext.disposable" preserve="true" />

import { asyncDispose as value } from "@serve-tools/ponyfill-resource-management/lib/Symbol/asyncDispose";

Symbol.asyncDispose || Object.defineProperty(Symbol, "asyncDispose", { value });
