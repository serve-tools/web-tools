import { Signal } from "@serve-tools/signal";
import { createEffect, effect } from "../src/signal-effect.js";

const count = new Signal.State(0);
const stopLogging = effect(() => console.log(count.get()));
let renderedCount = "";
const deferred = createEffect(() => (renderedCount = String(count.get())));

deferred.start();
count.set(1);

stopLogging();
deferred.dispose();
void renderedCount;
