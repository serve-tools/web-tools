import { DialogElement } from "@serve-tools/base-components/dialog";

export const mount = () => {
	customElements.define("weight-base-dialog", class extends DialogElement {});
	const element = document.createElement("weight-base-dialog");
	const dialog = document.createElement("dialog");
	dialog.setAttribute("aria-labelledby", "weight-dialog-title");
	const title = document.createElement("h2");
	title.id = "weight-dialog-title";
	title.textContent = "Settings";
	dialog.append(title);
	element.append(dialog);
	document.body.append(element);
};
