import { deserialize, serialize } from "@serve-tools/realtime-protocol";

/** Makes a binary structured-clone boundary explicit for transports and persistence. */
export function roundTrip<Value>(value: Value): Value {
	return deserialize(serialize(value)) as Value;
}
