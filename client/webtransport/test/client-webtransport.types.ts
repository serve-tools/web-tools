import { connect } from "../src/client-webtransport.js";
import type { DatagramWritableOptions, WebTransportLike } from "../src/lib/types.js";

interface LegacyWebTransportLike extends Omit<WebTransportLike, "datagrams"> {
	readonly datagrams: {
		readonly readable: ReadableStream<Uint8Array>;
		readonly writable: WritableStream<BufferSource>;
		readonly maxDatagramSize: number;
	};
}

interface ModernWebTransportLike extends Omit<WebTransportLike, "datagrams"> {
	readonly datagrams: {
		readonly readable: ReadableStream<Uint8Array>;
		readonly maxDatagramSize: number;
		createWritable(options?: DatagramWritableOptions): WritableStream<BufferSource>;
	};
}

declare const LegacyWebTransport: {
	new (url: string | URL, options?: Record<string, unknown>): LegacyWebTransportLike;
};
declare const ModernWebTransport: {
	new (url: string | URL, options?: Record<string, unknown>): ModernWebTransportLike;
};

connect("https://example.test/realtime", { transportConstructor: LegacyWebTransport });
connect("https://example.test/realtime", { transportConstructor: ModernWebTransport });
