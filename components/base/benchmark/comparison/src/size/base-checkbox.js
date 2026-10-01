import { CheckboxElement } from "@serve-tools/base-components/checkbox";

export const mount = () => {
	customElements.define("weight-base-checkbox", class extends CheckboxElement {});
	const element = document.createElement("weight-base-checkbox");
	element.id = "weight-checkbox";
	element.name = "choice";
	element.value = "on";
	element.checked = true;
	const label = document.createElement("label");
	label.htmlFor = element.id;
	label.textContent = "Option";
	document.body.append(element, label);
};
