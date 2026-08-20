/// <reference lib="esnext.decorators" preserve="true" />

import { metadata as value } from "@serve-tools/ponyfill-decorator-metadata/lib/Symbol/metadata";

/** The native `Symbol.metadata` when available, otherwise a module-scoped fallback symbol. */
export const metadata: typeof Symbol.metadata = Symbol.metadata || (value as typeof Symbol.metadata);
