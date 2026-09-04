import type {
	DrawerEventMap,
	DrawerSide,
	DrawerSnapDetail,
	ScrollAreaMetrics,
	ToastDismissDetail,
	ToastPriority,
	ToastRegionEventMap,
	ToastShowOptions,
} from "@serve-tools/aui";
import { DrawerElement, ScrollAreaElement, ToastRegionElement } from "@serve-tools/aui";
import type {
	DrawerElement as Drawer,
	DrawerEventMap as DrawerEvents,
	DrawerSide as DrawerPlacement,
	DrawerSnapDetail as SnapDetail,
} from "@serve-tools/aui/drawer";
import type { ScrollAreaElement as ScrollArea, ScrollAreaMetrics as ScrollMetrics } from "@serve-tools/aui/scroll-area";
import type {
	ToastDismissDetail as DismissDetail,
	ToastPriority as Priority,
	ToastShowOptions as ShowOptions,
	ToastRegionEventMap as ToastEvents,
	ToastRegionElement as ToastRegion,
} from "@serve-tools/aui/toast-region";

const constructors: [typeof Drawer, typeof ToastRegion, typeof ScrollArea] = [
	DrawerElement,
	ToastRegionElement,
	ScrollAreaElement,
];
const drawer = null as unknown as DrawerElement;
const toasts = null as unknown as ToastRegionElement;
const scrollArea = null as unknown as ScrollAreaElement;
const elements: HTMLElement[] = [drawer, toasts, scrollArea];

const drawerDialog: HTMLDialogElement | null = drawer.dialog;
const drawerOpen: boolean = drawer.open;
const drawerReturnValue: string = drawer.returnValue;
const drawerSide: DrawerSide = drawer.side;
const drawerPlacement: DrawerPlacement = drawerSide;
const snapPoints: readonly number[] = drawer.snapPoints;
const snapPoint: number = drawer.snapPoint;
drawer.side = "right";
drawer.snapPoints = [0, 0.5, 1];
drawer.snapPoint = 0.5;
drawer.show();
drawer.showModal();
drawer.snapTo(1);
drawer.close("done");
const onSnap = function (this: DrawerElement, event: DrawerEventMap["beforesnap"]): void {
	void (this satisfies DrawerElement);
	const subpathTyped: DrawerEvents["beforesnap"] = event;
	const detail: DrawerSnapDetail = event.detail;
	const subpathDetail: SnapDetail = detail;
	const point: number = detail.snapPoint;
	const source: PointerEvent = detail.sourceEvent;
	event.preventDefault();
	// @ts-expect-error Drawer proposal detail is immutable.
	detail.snapPoint = 0;
	void [subpathTyped, subpathDetail, point, source];
};
drawer.addEventListener("beforesnap", onSnap);
drawer.removeEventListener("beforesnap", onSnap);
drawer.addEventListener("custom", null);
drawer.removeEventListener("custom", null);
drawer.addEventListener("snapchange", (event) => {
	const typed: DrawerEventMap["snapchange"] = event;
	void typed.detail.snapPoint;
});

const toastDuration: number = toasts.duration;
const toastF6: boolean = toasts.f6;
toasts.duration = 5000;
toasts.f6 = true;
const priority: ToastPriority = "assertive";
const subpathPriority: Priority = priority;
const options: ToastShowOptions = { duration: 0, priority };
const subpathOptions: ShowOptions = options;
const toast: HTMLElement = toasts.show("saved", options);
const dismissed: boolean = toasts.dismiss("saved", "application");
toasts.focus({ preventScroll: true });
const onDismiss = function (this: ToastRegionElement, event: ToastRegionEventMap["beforedismiss"]): void {
	void (this satisfies ToastRegionElement);
	const subpathTyped: ToastEvents["beforedismiss"] = event;
	const detail: ToastDismissDetail = event.detail;
	const subpathDetail: DismissDetail = detail;
	const reason: string = detail.reason;
	const dismissedToast: HTMLElement = detail.toast;
	event.preventDefault();
	// @ts-expect-error Dismissal detail is immutable.
	detail.reason = "changed";
	void [subpathTyped, subpathDetail, reason, dismissedToast];
};
toasts.addEventListener("beforedismiss", onDismiss);
toasts.removeEventListener("beforedismiss", onDismiss);
toasts.addEventListener("custom", null);
toasts.removeEventListener("custom", null);
toasts.addEventListener("toastdismiss", (event) => {
	const typed: ToastRegionEventMap["toastdismiss"] = event;
	void typed.detail.toast;
});

const viewport: HTMLElement | null = scrollArea.viewport;
const metrics: ScrollAreaMetrics = scrollArea.metrics;
const subpathMetrics: ScrollMetrics = metrics;
const inline: number = metrics.inline;
const block: number = metrics.block;
const maxInline: number = metrics.maxInline;
const maxBlock: number = metrics.maxBlock;
const clientWidth: number = metrics.clientWidth;
const clientHeight: number = metrics.clientHeight;
const scrollWidth: number = metrics.scrollWidth;
const scrollHeight: number = metrics.scrollHeight;
scrollArea.scrollTo(10, 20);
scrollArea.scrollTo({ left: 10, top: 20, behavior: "smooth" });
scrollArea.scrollBy(5, 10);
scrollArea.scrollBy({ left: 5, top: 10 });

// @ts-expect-error Drawer side uses a closed vocabulary.
drawer.side = "center";
// @ts-expect-error Snap points are numeric fractions.
drawer.snapPoints = ["half"];
// @ts-expect-error Toast duration is numeric.
toasts.duration = "5000";
// @ts-expect-error F6 is boolean reflected state.
toasts.f6 = "true";
// @ts-expect-error Toast priority uses a closed vocabulary.
toasts.show("saved", { priority: "urgent" });
// @ts-expect-error Scroll options use native numeric coordinates.
scrollArea.scrollTo("start");
// @ts-expect-error Metrics are immutable snapshots.
metrics.inline = 10;
// @ts-expect-error The authored viewport is readonly.
scrollArea.viewport = document.createElement("div");

void [
	constructors,
	elements,
	drawerDialog,
	drawerOpen,
	drawerReturnValue,
	drawerPlacement,
	snapPoints,
	snapPoint,
	toastDuration,
	toastF6,
	subpathPriority,
	subpathOptions,
	toast,
	dismissed,
	viewport,
	subpathMetrics,
	inline,
	block,
	maxInline,
	maxBlock,
	clientWidth,
	clientHeight,
	scrollWidth,
	scrollHeight,
];
