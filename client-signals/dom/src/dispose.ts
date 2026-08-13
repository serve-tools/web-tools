/** Stops one reactive binding. */
export type Disposer = () => void;

const ownership = new WeakMap<object, Disposer | Disposer[]>();

/** @internal Registers a cleanup with its DOM owner. */
export const own = (owner: object, cleanup: Disposer): void => {
	const cleanups = ownership.get(owner);

	if (cleanups === undefined) {
		ownership.set(owner, cleanup);
	} else if (typeof cleanups === "function") {
		ownership.set(owner, [cleanups, cleanup]);
	} else {
		cleanups.push(cleanup);
	}
};

/** @internal Unregisters a cleanup from its DOM owner. */
export const disown = (owner: object, cleanup: Disposer): void => {
	const cleanups = ownership.get(owner);

	if (cleanups === cleanup) {
		ownership.delete(owner);
	} else if (typeof cleanups === "object") {
		const index = cleanups.indexOf(cleanup);

		if (index !== -1) {
			cleanups.splice(index, 1);
		}

		if (!cleanups.length) {
			ownership.delete(owner);
		}
	}
};

/** Stops reactive updates owned by a node, its current DOM subtree, or a stylesheet. */
export const dispose = (root: Node | CSSStyleSheet): void => {
	if ("childNodes" in root) {
		for (const child of root.childNodes) {
			dispose(child);
		}

		const shadowRoot = (root as Element).shadowRoot;

		if (shadowRoot) {
			dispose(shadowRoot);
		}
	}

	const cleanups = ownership.get(root);

	if (!cleanups) {
		return;
	}

	ownership.delete(root);

	if (typeof cleanups === "function") {
		cleanups();
	} else {
		for (const cleanup of cleanups) {
			cleanup();
		}
	}
};
