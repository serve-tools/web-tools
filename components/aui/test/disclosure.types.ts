import type {
	AccordionChangeDetail,
	AccordionEventMap,
	AccordionOrientation,
	CollapsibleChangeDetail,
	CollapsibleEventMap,
} from "@serve-tools/aui";
import { AccordionElement, CollapsibleElement } from "@serve-tools/aui";
import type { AccordionElement as Accordion } from "@serve-tools/aui/accordion";
import type { CollapsibleElement as Collapsible } from "@serve-tools/aui/collapsible";

const accordion: typeof Accordion = AccordionElement;
const collapsible: typeof Collapsible = CollapsibleElement;
const group = null as unknown as AccordionElement;
const disclosure = null as unknown as CollapsibleElement;
const groupElement: HTMLElement = group;
const disclosureElement: HTMLElement = disclosure;
const orientation: AccordionOrientation = "vertical";
group.orientation = orientation;
group.values = ["details"];
group.multiple = true;
group.loopFocus = false;
disclosure.open = true;
disclosure.value = "details";
const button: HTMLButtonElement | null = disclosure.button;
const panel: HTMLElement | null = disclosure.panel;
const children: readonly CollapsibleElement[] = group.disclosures;

disclosure.addEventListener("beforechange", function (event) {
	void (this satisfies CollapsibleElement);
	const detail: CollapsibleChangeDetail = event.detail;
	const typed: CollapsibleEventMap["beforechange"] = event;
	// @ts-expect-error Proposed state is immutable.
	detail.open = true;
	void typed;
});
group.addEventListener("beforechange", function (event) {
	void (this satisfies AccordionElement);
	const typed: AccordionEventMap["beforechange"] = event;
	if ("values" in event.detail) {
		const detail: AccordionChangeDetail = event.detail;
		const source: CollapsibleElement = detail.sourceDisclosure;
		// @ts-expect-error Proposed values are immutable.
		detail.values.push("other");
		void source;
	} else {
		const detail: CollapsibleChangeDetail = event.detail;
		const open: boolean = detail.open;
		void open;
	}
	event.preventDefault();
	void typed;
});
group.addEventListener("keydown", (event) => void event.key);
group.addEventListener("custom", null);
group.removeEventListener("custom", null);
disclosure.addEventListener("custom", null);
disclosure.removeEventListener("custom", null);
// @ts-expect-error Use an array for zero, one, or several open values.
group.values = "details";
// @ts-expect-error Membership is a readonly snapshot.
group.disclosures.push(disclosure);
// @ts-expect-error Controlled targets are readonly.
disclosure.button = document.createElement("button");

void [accordion, collapsible, groupElement, disclosureElement, button, panel, children];
