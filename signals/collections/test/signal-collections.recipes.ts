import { Signal } from "@serve-tools/signal";
import { SignalMap, SignalObject } from "../src/signal-collections.js";

const users = new SignalMap<string, { name: string }>();
const filters = new SignalObject({ query: "" });
const selectedName = new Signal.Computed(() => users.get(filters.query)?.name);

users.set("ada", { name: "Ada" });
filters.query = "ada";

console.log(selectedName.get());
