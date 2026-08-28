import type { TabsActivation, TabsOrientation } from "@serve-tools/aui";
import { AUIElement, DialogElement, TabsElement } from "@serve-tools/aui";
import type { AUIElement as BaseElement } from "@serve-tools/aui/base";
import type { DialogElement as Dialog } from "@serve-tools/aui/dialog";
import type { TabsElement as Tabs } from "@serve-tools/aui/tabs";

const base: typeof BaseElement = AUIElement;
const dialog: typeof Dialog = DialogElement;
const tabs: typeof Tabs = TabsElement;
const activation: TabsActivation = "manual";
const orientation: TabsOrientation = "vertical";

class ApplicationElement extends AUIElement {
	protected layout(content: DocumentFragment): void {
		content.append(this.ownerDocument.createTextNode("ready"));
	}

	protected connect(connection: AUIElement.Connection): () => void {
		this.ownerDocument.addEventListener("application-event", () => {}, { signal: connection.signal });
		return () => {};
	}

	protected moved(connection: AUIElement.Connection): void {
		connection.addCleanup(() => {});
	}
}

void [base, dialog, tabs, activation, orientation, ApplicationElement];
