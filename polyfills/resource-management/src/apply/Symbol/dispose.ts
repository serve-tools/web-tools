/// <reference lib="esnext.disposable" preserve="true" />

import { dispose as value } from "@serve-tools/ponyfill-resource-management/lib/Symbol/dispose";

Symbol.dispose || Object.defineProperty(Symbol, "dispose", { value });
