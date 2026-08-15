/// <reference lib="esnext.disposable" />

import { EventTargetSignal, MatchMediaSignal } from "../src/signal-event-target.js";

const controller = new AbortController();
const button = document.createElement("button");
const clicks = new EventTargetSignal(button, "click", () => performance.now(), { signal: controller.signal });
const darkMode = new MatchMediaSignal("(prefers-color-scheme: dark)");

clicks.refresh();
console.log(clicks.get(), darkMode.get());

controller.abort();
clicks.dispose();
darkMode.dispose();
