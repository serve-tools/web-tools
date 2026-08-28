import type { DrawerElement, ScrollAreaElement, ToastRegionElement } from "@serve-tools/aui";

/** Demonstrates native drawers, local notifications, and authored scroll viewports. */
export function initializeSurfaceExamples(): void {
	const drawer = document.querySelector<DrawerElement>("#settings-drawer")!;
	drawer.snapPoints = [0, 0.5, 1];
	document.querySelector("#open-drawer")!.addEventListener("click", () => drawer.showModal());
	document.querySelector("#half-drawer")!.addEventListener("click", () => drawer.snapTo(0.5));
	document.querySelector("#expand-drawer")!.addEventListener("click", () => drawer.snapTo(1));
	drawer.addEventListener("close", () => {
		document.querySelector("#drawer-result")!.textContent = `Drawer result: ${drawer.returnValue || "dismissed"}`;
	});
	const region = document.querySelector<ToastRegionElement>("#notifications")!;
	document.querySelector("#show-toast")!.addEventListener("click", () => {
		region.show("saved-toast", { duration: 5000, priority: "polite" });
		document.querySelector("#toast-result")!.textContent = "Notification shown; hover or focus it to pause.";
	});
	document.querySelector("#show-persistent-toast")!.addEventListener("click", () => {
		region.show("review-toast", { duration: 0, priority: "polite" });
		document.querySelector("#toast-result")!.textContent = "Persistent notification shown.";
	});
	region.addEventListener("toastdismiss", (event) => {
		document.querySelector("#toast-result")!.textContent = `Notification dismissed: ${event.detail.reason}`;
	});
	const scroll = document.querySelector<ScrollAreaElement>("#document-scroll")!;
	const viewport = scroll.viewport!;
	const position = document.querySelector<HTMLOutputElement>("#scroll-position")!;
	const showScroll = (): void => {
		if (!scroll.isConnected) {
			return;
		}
		const metrics = scroll.metrics;
		position.textContent = `Scrolled ${Math.round(metrics.block)} of ${Math.round(metrics.maxBlock)} px vertically`;
	};
	viewport.addEventListener("scroll", showScroll, { passive: true });
	document
		.querySelector("#scroll-next")!
		.addEventListener("click", () => scroll.scrollBy({ top: 150, behavior: "smooth" }));
	document
		.querySelector("#scroll-top")!
		.addEventListener("click", () => scroll.scrollTo({ top: 0, left: 0, behavior: "instant" }));
	showScroll();
}
