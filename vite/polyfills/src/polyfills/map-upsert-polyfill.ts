import { definePolyfill } from "../plugin/define-polyfill.js";

const RUNTIME_CODE = [
	`if(!Map.prototype.getOrInsert){`,
	`for(const{prototype:p}of[Map,WeakMap]){`,
	`const{constructor,...d}=Object.getOwnPropertyDescriptors(class{`,
	`getOrInsert(k,v){return this.has(k)?this.get(k):(this.set(k,v),v)}`,
	`getOrInsertComputed(k,c){return this.has(k)?this.get(k):(c=c(k),this.set(k,c),c)}`,
	`}.prototype);`,
	`Object.defineProperties(p,d)}}`,
].join("");

/**
 * Polyfills `Map.prototype.getOrInsert` / `getOrInsertComputed` and the
 * matching `WeakMap` methods from the Map.prototype.{getOrInsert,
 * getOrInsertComputed} ("Upsert") proposal.
 */
export default definePolyfill({
	id: "map-upsert",
	code: RUNTIME_CODE,
	detect: (found) => ({
		MemberExpression(node) {
			if (node.computed) {
				return;
			}

			if (node.property.type !== "Identifier") {
				return;
			}

			const { name } = node.property;

			if (name !== "getOrInsert" && name !== "getOrInsertComputed") {
				return;
			}

			found();
		},
	}),
});
