import { CheckboxElement } from "@serve-tools/base-components/checkbox";

class WeightCheckboxElement extends CheckboxElement {}

customElements.define("weight-base-checkbox", WeightCheckboxElement);

const form = document.createElement("form");
const checkbox = document.createElement("weight-base-checkbox");
checkbox.id = "weight-checkbox";
checkbox.name = "choice";
checkbox.value = "on";
checkbox.checked = true;
const label = document.createElement("label");
label.htmlFor = checkbox.id;
label.textContent = "Option";
form.append(checkbox, label);
document.body.append(form);
