/// <reference lib="esnext.decorators" preserve="true" />

import { metadata as value } from "@serve-tools/ponyfill-decorator-metadata/lib/Symbol/metadata";

Symbol.metadata || Object.defineProperty(Symbol, "metadata", { value });
