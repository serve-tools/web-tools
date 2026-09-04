import { DisposableStack } from "@serve-tools/ponyfill-resource-management";

class CleanupBag {
	constructor(readonly stack = new DisposableStack()) {}
	defer(callback: () => void): void {
		this.stack.defer(callback);
	}
	move(): CleanupBag {
		return new CleanupBag(this.stack.move());
	}
	dispose(): void {
		this.stack.dispose();
	}
}
export function createCleanupBag(): CleanupBag {
	return new CleanupBag();
}
