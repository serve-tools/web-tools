import type { TemplateDirective, TemplateFragment, TemplateResult } from "@serve-tools/base-components/template";
import {
	createFragment,
	html,
	isTemplateResult,
	PersistentFragment,
	scopedHtml,
} from "@serve-tools/base-components/template";
import { Signal } from "@serve-tools/signal";

const owner = document.createElement("div");
const value = new Signal.State("ready");
const directive: TemplateDirective = (element) => {
	element.setAttribute("data-ready", "");
	return () => element.removeAttribute("data-ready");
};
const result: TemplateResult = html`<button ${directive}>${value}</button>`;
const view: TemplateFragment = createFragment(result, owner);
const nested: TemplateResult = html`<section>${result}</section>`;
const recognized: boolean = isTemplateResult(result);
const scopedView: TemplateFragment = scopedHtml(owner)`<button ${directive}>${value}</button>`;
const fragment: DocumentFragment = view;
const region: PersistentFragment = new PersistentFragment([view]);
const explicitDocument: TemplateFragment = createFragment(html`<div>${region}</div>`, {}, document);
const explicitScopedDocument: TemplateFragment = scopedHtml({}, document)`<div>${region}</div>`;
const functionOwner: TemplateFragment = html(() => {})`<div></div>`;

view.dispose();
region.hidden = true;
region.insertBefore(owner);

// @ts-expect-error Template ownership requires a weakly held object, not a primitive.
html("owner");
// @ts-expect-error Null is not a template owner.
html(null);
// @ts-expect-error Scoped template ownership requires a weakly held object, not a primitive.
scopedHtml("owner");
// @ts-expect-error Directives must return synchronous cleanup, not a promise.
const asynchronousDirective: TemplateDirective = async () => {};

void [
	nested,
	recognized,
	fragment,
	scopedView,
	explicitDocument,
	explicitScopedDocument,
	functionOwner,
	asynchronousDirective,
];

// @ts-expect-error Descriptions are inert values, not DOM fragments.
const invalidFragment: DocumentFragment = result;
// @ts-expect-error Instantiation requires an object context.
createFragment(result, "owner");
void invalidFragment;
