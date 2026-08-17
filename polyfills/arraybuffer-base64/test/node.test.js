import assert from "node:assert/strict";
import test from "node:test";

const originalDescriptor = Object.getOwnPropertyDescriptor(Uint8Array.prototype, "toBase64");

test.afterEach(() => {
	if (originalDescriptor) {
		Object.defineProperty(Uint8Array.prototype, "toBase64", originalDescriptor);
	} else {
		delete Uint8Array.prototype.toBase64;
	}
});

test("installs a non-enumerable writable and configurable method when missing", async () => {
	delete Uint8Array.prototype.toBase64;
	await import("../runtime/node.js?install");

	const descriptor = Object.getOwnPropertyDescriptor(Uint8Array.prototype, "toBase64");

	assert.equal(new Uint8Array([251, 255]).toBase64(), "+/8=");
	assert.equal(new Uint8Array([251, 255]).toBase64({ alphabet: "base64url", omitPadding: true }), "-_8");
	assert.equal(descriptor.enumerable, false);
	assert.equal(descriptor.configurable, true);
	assert.equal(descriptor.writable, true);
	assert.equal(descriptor.value.length, 0);
	assert.equal(descriptor.value.name, "toBase64");
});

test("preserves an existing native implementation", async () => {
	const native = () => "native";
	Object.defineProperty(Uint8Array.prototype, "toBase64", {
		configurable: true,
		writable: true,
		value: native,
	});

	await import("../runtime/node.js?preserve");

	assert.equal(Uint8Array.prototype.toBase64, native);
});
