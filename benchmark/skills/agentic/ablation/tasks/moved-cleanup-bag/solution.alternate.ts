import { DisposableStack } from "@serve-tools/ponyfill-resource-management";

export function createCleanupBag() {
	return makeOwner(new DisposableStack());
}

function makeOwner(stack: DisposableStack) {
	return {
		defer(callback: () => void): void {
			if (typeof callback !== "function") {
				throw new TypeError("Expected a callback");
			}
			stack.defer(callback);
		},
		move() {
			const moved = stack.move();
			return makeOwner(moved);
		},
		dispose(): void {
			stack.dispose();
		},
	};
}
