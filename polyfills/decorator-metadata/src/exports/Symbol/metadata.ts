import { metadata as fallback } from "@serve-tools/ponyfill-decorator-metadata/lib/Symbol/metadata";

const nativeValue = Reflect.get(Symbol, "metadata") as typeof fallback | undefined;

/** The native `Symbol.metadata` when available, otherwise a module-scoped fallback symbol. */
export const metadata: typeof fallback = nativeValue || fallback;
