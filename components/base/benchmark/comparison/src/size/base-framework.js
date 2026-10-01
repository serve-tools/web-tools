import { BaseElement } from "@serve-tools/base-components/base";
import { html } from "@serve-tools/base-components/template";

class WeightBaseElement extends BaseElement {
	protectedLayoutMarker = true;

	layout() {
		return html`<span>Framework baseline</span>`;
	}
}

customElements.define("weight-base-framework", WeightBaseElement);
document.body.append(document.createElement("weight-base-framework"));
