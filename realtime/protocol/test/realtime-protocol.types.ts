import type { ProtocolDefinition, ProtocolResource, ProtocolType } from "../src/realtime-protocol.js";

interface ExampleProtocol {
	requests: {
		ping(): void;
	};
}

type Equal<Left, Right> =
	(<Value>() => Value extends Left ? 1 : 2) extends <Value>() => Value extends Right ? 1 : 2 ? true : false;
type Expect<Value extends true> = Value;

declare const resource: ProtocolResource<ExampleProtocol>;

export type ExtractedProtocol = Expect<Equal<ProtocolType<Promise<typeof resource>>, ExampleProtocol>>;

const valid: ProtocolDefinition<ExampleProtocol> = {} as ExampleProtocol;

// @ts-expect-error operations accept zero or one input
const invalid: ProtocolDefinition<{ requests: { operation(first: string, second: string): void } }> = {};

export { invalid, valid };
