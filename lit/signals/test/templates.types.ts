import { Signal } from "@serve-tools/signal";
import type { CSSResult, HTMLTemplateResult, SVGTemplateResult } from "lit";

import { css, html, svg } from "../src/lit-signals.js";

const count = new Signal.State(1);
const label = new Signal.Computed(() => `Count: ${count.get()}`);

const htmlResult: HTMLTemplateResult = html`<p title=${label}>${count}</p>`;
const svgResult: SVGTemplateResult = svg`<circle r=${count}></circle>`;
const cssResult: CSSResult = css`:host { display: block; }`;

void [cssResult, htmlResult, svgResult];
