import { LitElement } from "lit";
import { SignalWatcher } from "../mixins/SignalWatcher.js";

/** A Lit element whose update lifecycle automatically tracks Signal reads. */
export class SignalElement extends SignalWatcher(LitElement) {}
