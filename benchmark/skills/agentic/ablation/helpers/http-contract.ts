import type { APIDefinition, NormalizedAPI } from "@serve-tools/http-contract";
import { defineAPI } from "@serve-tools/http-contract";

/** Validates and freezes an API definition before it is shared with clients and handlers. */
export function defineContract<const Definition extends APIDefinition>(
	definition: Definition & Record<Exclude<keyof Definition, keyof APIDefinition>, never>,
): NormalizedAPI<Definition & Record<Exclude<keyof Definition, keyof APIDefinition>, never>> {
	return defineAPI(definition);
}
