import type { LitElement } from "lit";

import { SignalElement, type SignalWatcherApi } from "../src/lit-signals.js";

class TestElement extends SignalElement {}

const element = new TestElement();

element satisfies LitElement;
element satisfies SignalWatcherApi;
