import { Signal } from "@serve-tools/signal";
import { attrs, html, text } from "../src/signal-dom.js";

const count = new Signal.State(0);
const label = new Signal.Computed(() => `Count: ${count.get()}`);
const button = html("button", attrs({ title: label }), text(label))();

button.addEventListener("click", () => count.set(count.get() + 1));
document.body.append(button);
