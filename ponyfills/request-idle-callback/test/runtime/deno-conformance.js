import * as denoRuntime from "../../runtime/deno.js";
import { runConformance } from "./conformance.js";

await runConformance(denoRuntime);
