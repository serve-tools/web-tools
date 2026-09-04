import type { TemplateDirective, TemplateFragment } from "@serve-tools/aui/template";
import { html, PersistentFragment, scopedHtml } from "@serve-tools/aui/template";
import { Signal } from "@serve-tools/signal";

const owner = document.createElement("div");
const value = new Signal.State("ready");
const directive: TemplateDirective = (element) => {
	element.setAttribute("data-ready", "");
	return () => element.removeAttribute("data-ready");
};
const view: TemplateFragment = html(owner)`<button ${directive}>${value}</button>`;
const scopedView: TemplateFragment = scopedHtml(owner)`<button ${directive}>${value}</button>`;
const fragment: DocumentFragment = view;
const region: PersistentFragment = new PersistentFragment([view]);
const explicitDocument: TemplateFragment = html({}, document)`<div>${region}</div>`;
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

void [fragment, scopedView, explicitDocument, explicitScopedDocument, functionOwner, asynchronousDirective];
