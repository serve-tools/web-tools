/** Private state exposed by a menu to a containing menu or menubar. */
export interface MenuHandle {
	readonly element: HTMLElement;
	readonly open: boolean;
	readonly popup: HTMLElement | null;
	readonly trigger: HTMLButtonElement | null;
	closeFromParent(): void;
	openFromParent(edge: "first" | "last" | "none"): boolean;
}

const menus = new WeakMap<HTMLElement, MenuHandle>();
const triggers = new WeakMap<HTMLElement, MenuHandle>();

export const registerMenu = (element: HTMLElement, handle: MenuHandle): void => {
	menus.set(element, handle);
};

export const updateMenuTrigger = (
	handle: MenuHandle,
	previous: HTMLButtonElement | undefined,
	next: HTMLButtonElement | undefined,
): void => {
	if (previous && triggers.get(previous) === handle) {
		triggers.delete(previous);
	}
	if (next) {
		triggers.set(next, handle);
	}
};

export const getMenuByTrigger = (element: Element): MenuHandle | undefined => triggers.get(element as HTMLElement);

/** Finds the nearest registered menu whose popup contains a node. */
export const getContainingMenu = (node: Element, excluded?: MenuHandle): MenuHandle | undefined => {
	for (let current = node.parentElement; current; current = current.parentElement) {
		const handle = menus.get(current);
		if (handle && handle !== excluded && handle.popup?.contains(node)) {
			return handle;
		}
	}
	return undefined;
};

/** Registered menu children whose hosts are direct children of a composite host. */
export const directMenuChildren = (host: HTMLElement): readonly MenuHandle[] => {
	const result: MenuHandle[] = [];
	for (const child of host.children) {
		const menu = menus.get(child as HTMLElement);
		if (menu) {
			result.push(menu);
		}
	}
	return result;
};

/** Notifies a connected parent composite that a menu handle became available or changed. */
export const notifyMenuChange = (handle: MenuHandle): void => {
	const EventConstructor = handle.element.ownerDocument.defaultView?.Event ?? Event;
	handle.element.dispatchEvent(new EventConstructor("aui-menuchange", { bubbles: true }));
};
