import { CheckboxElement } from "@serve-tools/aui/checkbox";

class WeightCheckboxElement extends CheckboxElement {}

customElements.define("weight-aui-checkbox", WeightCheckboxElement);

const form = document.createElement("form");
const checkbox = document.createElement("weight-aui-checkbox");
checkbox.id = "weight-checkbox";
checkbox.name = "choice";
checkbox.value = "on";
checkbox.checked = true;
const label = document.createElement("label");
label.htmlFor = checkbox.id;
label.textContent = "Option";
form.append(checkbox, label);
document.body.append(form);
