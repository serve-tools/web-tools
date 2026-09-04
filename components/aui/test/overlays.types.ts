import type { PopoverEventMap } from "@serve-tools/aui";
import { AlertDialogElement, PopoverElement, PreviewCardElement, TooltipElement } from "@serve-tools/aui";
import type { AlertDialogElement as AlertDialog } from "@serve-tools/aui/alert-dialog";
import type { PopoverElement as Popover } from "@serve-tools/aui/popover";
import type { PreviewCardElement as PreviewCard } from "@serve-tools/aui/preview-card";
import type { TooltipElement as Tooltip } from "@serve-tools/aui/tooltip";

const constructors: [typeof AlertDialog, typeof Popover, typeof PreviewCard, typeof Tooltip] = [
	AlertDialogElement,
	PopoverElement,
	PreviewCardElement,
	TooltipElement,
];
const popover = null as unknown as PopoverElement;
const preview = null as unknown as PreviewCardElement;
const tooltip = null as unknown as TooltipElement;
const alert = null as unknown as AlertDialogElement;
const source = null as unknown as HTMLButtonElement;
const elements: HTMLElement[] = [popover, preview, tooltip, alert];
const popup: HTMLElement | null = popover.popup;
const trigger: HTMLElement | null = tooltip.trigger;
const link: HTMLAnchorElement | null = preview.trigger;
const dialog: HTMLDialogElement | null = alert.dialog;
const result: string = alert.returnValue;
popover.show(source);
const opened: boolean = popover.toggle(source);
popover.hide();
tooltip.delay = 200;
tooltip.closeDelay = 100;
tooltip.show();
const tooltipOpened: boolean = tooltip.toggle(source);
tooltip.hide();
preview.delay = 300;
preview.show();
alert.showModal();
alert.close("cancel");
popover.addEventListener("beforetoggle", (event) => {
	const typed: PopoverEventMap["beforetoggle"] = event;
	const source: Element | null = event.source;
	const state: string = event.newState;
	if (event.cancelable) {
		event.preventDefault();
	}
	void [typed, source, state];
});
// @ts-expect-error Native open state is read, not a reflected request property.
popover.open = true;
// @ts-expect-error Alert Dialog intentionally offers modal opening only.
alert.show();
// @ts-expect-error Delay is a numeric duration.
tooltip.delay = "200";
void [constructors, elements, popup, trigger, link, dialog, result, opened, tooltipOpened];
