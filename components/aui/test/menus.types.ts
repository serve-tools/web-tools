import type {
	ContextMenuPoint,
	MenubarTarget,
	MenuChangeDetail,
	MenuEventMap,
	MenuTarget,
	NavigationMenuTarget,
	ToolbarTarget,
} from "@serve-tools/aui";
import {
	ContextMenuElement,
	MenubarElement,
	MenuElement,
	NavigationMenuElement,
	ToolbarElement,
} from "@serve-tools/aui";
import type {
	ContextMenuElement as ContextMenu,
	ContextMenuPoint as ContextPoint,
} from "@serve-tools/aui/context-menu";
import type {
	MenuElement as Menu,
	MenuChangeDetail as MenuDetail,
	MenuEventMap as MenuEvents,
	MenuTarget as MenuItemTarget,
} from "@serve-tools/aui/menu";
import type { MenubarElement as Menubar, MenubarTarget as MenubarItemTarget } from "@serve-tools/aui/menubar";
import type {
	NavigationMenuElement as NavigationMenu,
	NavigationMenuTarget as NavigationTarget,
} from "@serve-tools/aui/navigation-menu";
import type { ToolbarElement as Toolbar, ToolbarTarget as ToolbarItemTarget } from "@serve-tools/aui/toolbar";

const constructors: [typeof Menu, typeof ContextMenu, typeof Menubar, typeof NavigationMenu, typeof Toolbar] = [
	MenuElement,
	ContextMenuElement,
	MenubarElement,
	NavigationMenuElement,
	ToolbarElement,
];
const menu = null as unknown as MenuElement;
const contextMenu = null as unknown as ContextMenuElement;
const menubar = null as unknown as MenubarElement;
const navigation = null as unknown as NavigationMenuElement;
const toolbar = null as unknown as ToolbarElement;
const elements: HTMLElement[] = [menu, contextMenu, menubar, navigation, toolbar];
const button = null as unknown as HTMLButtonElement;
const item = null as unknown as HTMLElement;

const menuTrigger: HTMLElement | null = menu.trigger;
const menuPopup: HTMLElement | null = menu.popup;
const menuItems: readonly HTMLElement[] = menu.items;
const activeMenuItem: HTMLElement | null = menu.activeItem;
const menuOpen: boolean = menu.open;
const menuOrientation: "horizontal" | "vertical" = menu.orientation;
menu.orientation = "horizontal";
menu.loopFocus = false;
menu.openOnHover = true;
menu.delay = 100;
menu.closeDelay = 0;
menu.show(button);
menu.hide();
const toggled: boolean = menu.toggle(button);
const focusedMenuItem: boolean = menu.focusItem(0, { preventScroll: true });
menu.focusItem("item-id");
menu.focusItem(item);
menu.setChecked(button, true);

const menuTarget: MenuTarget = item;
const subpathMenuTarget: MenuItemTarget = menuTarget;
menu.addEventListener("beforechange", function (event) {
	void (this satisfies MenuElement);
	const typed: MenuEventMap["beforechange"] = event;
	const subpathTyped: MenuEvents["beforechange"] = event;
	const detail: MenuChangeDetail = event.detail;
	const subpathDetail: MenuDetail = detail;
	const checked: boolean = detail.checked;
	const changedItem: HTMLButtonElement = detail.item;
	const source: MouseEvent = detail.sourceEvent;
	event.preventDefault();
	// @ts-expect-error Menu proposal detail is immutable.
	detail.checked = false;
	void [typed, subpathTyped, subpathDetail, checked, changedItem, source];
});
menu.addEventListener("beforetoggle", (event) => {
	const typed: ToggleEvent = event;
	const source: Element | null = event.source;
	void [typed, source];
});
menu.addEventListener("keydown", (event) => void event.key);
menu.addEventListener("arbitraryevent", { handleEvent: (event) => void event.type });
menu.addEventListener("arbitraryevent", null);
menu.removeEventListener("beforechange", (event) => {
	const typed: MenuEventMap["beforechange"] = event;
	void typed;
});
menu.removeEventListener("arbitraryevent", null);

const contextTrigger: HTMLElement | null = contextMenu.trigger;
const point: ContextMenuPoint = { x: 10, y: 20 };
const subpathPoint: ContextPoint = point;
contextMenu.showAt(point.x, point.y, contextTrigger ?? undefined);
contextMenu.show(contextTrigger ?? undefined);
// @ts-expect-error Context menu points are immutable snapshots.
point.x = 20;

const menubarItems: readonly HTMLElement[] = menubar.items;
const activeMenubarItem: HTMLElement | null = menubar.activeItem;
const openMenu: HTMLElement | null = menubar.openMenu;
const menubarOrientation: "horizontal" | "vertical" = menubar.orientation;
menubar.orientation = "vertical";
menubar.loopFocus = true;
const focusedMenubarItem: boolean = menubar.focusItem("file-menu");
menubar.close();
const menubarTarget: MenubarTarget = 0;
const subpathMenubarTarget: MenubarItemTarget = menubarTarget;

const list: HTMLElement | null = navigation.list;
const navigationItems: readonly HTMLElement[] = navigation.items;
const disclosureTriggers: readonly HTMLButtonElement[] = navigation.disclosureTriggers;
const openTrigger: HTMLButtonElement | null = navigation.openTrigger;
const navigationOrientation: "horizontal" | "vertical" = navigation.orientation;
navigation.orientation = "vertical";
navigation.delay = 50;
navigation.closeDelay = 50;
const shown: boolean = navigation.show(button);
navigation.hide();
const focusedNavigationItem: boolean = navigation.focusItem(item);
const navigationTarget: NavigationMenuTarget = "products";
const subpathNavigationTarget: NavigationTarget = navigationTarget;

const toolbarItems: readonly HTMLElement[] = toolbar.items;
const activeToolbarItem: HTMLElement | null = toolbar.activeItem;
const toolbarOrientation: "horizontal" | "vertical" = toolbar.orientation;
toolbar.orientation = "horizontal";
toolbar.loopFocus = false;
toolbar.disabled = true;
const focusedToolbarItem: boolean = toolbar.focusItem(button);
const toolbarTarget: ToolbarTarget = button;
const subpathToolbarTarget: ToolbarItemTarget = toolbarTarget;

// @ts-expect-error Orientation accepts only the two supported axes.
menu.orientation = "diagonal";
// @ts-expect-error Durations are finite nonnegative numbers.
contextMenu.delay = "100";
// @ts-expect-error Menu item snapshots are readonly.
menuItems.push(item);
// @ts-expect-error Checked state requires a native button item.
menu.setChecked(item, true);
// @ts-expect-error Navigation show requires a native disclosure button.
navigation.show(item);
// @ts-expect-error Open menu identity is readonly.
menubar.openMenu = menu;

void [
	constructors,
	elements,
	menuTrigger,
	menuPopup,
	activeMenuItem,
	menuOpen,
	menuOrientation,
	toggled,
	focusedMenuItem,
	subpathMenuTarget,
	contextTrigger,
	subpathPoint,
	menubarItems,
	activeMenubarItem,
	openMenu,
	menubarOrientation,
	focusedMenubarItem,
	subpathMenubarTarget,
	list,
	navigationItems,
	disclosureTriggers,
	openTrigger,
	navigationOrientation,
	shown,
	focusedNavigationItem,
	subpathNavigationTarget,
	toolbarItems,
	activeToolbarItem,
	toolbarOrientation,
	focusedToolbarItem,
	subpathToolbarTarget,
];
