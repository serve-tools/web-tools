import { assert, loadSolution } from "../_shared.mjs";

const { inspectRequestTarget } = await loadSolution();

assert.deepEqual(inspectRequestTarget("releases/stable"), {
	channel: "stable",
	page: undefined,
	labels: [],
});
assert.deepEqual(inspectRequestTarget("https://user:pass@example.test:8443/releases/beta?page=-2#ignored"), {
	channel: "beta",
	page: -2,
	labels: [],
});
assert.deepEqual(
	inspectRequestTarget(
		new URL("http://another.test/releases/stable?page=0&label=first&unknown=x&label=hidden&label=a%20b&label=%2B"),
	),
	{
		channel: "stable",
		page: 0,
		labels: ["first", "hidden", "a b", "+"],
	},
);
assert.deepEqual(inspectRequestTarget(`/releases/beta?page=${Number.MAX_SAFE_INTEGER}&label=`), {
	channel: "beta",
	page: Number.MAX_SAFE_INTEGER,
	labels: [""],
});

for (const invalid of [
	null,
	undefined,
	0,
	{},
	[],
	new Request("https://example.test/releases/stable"),
	"http://[::1",
	"ftp://example.test/releases/stable",
	"data:text/plain,/releases/stable",
	"/releases/canary",
	"/other/stable",
	"/releases/stable/",
	"/releases/stable?page=",
	"/releases/stable?page=-0",
	"/releases/stable?page=01",
	"/releases/stable?page=1.0",
	"/releases/stable?page=+1",
	"/releases/stable?page=9007199254740992",
	"/releases/stable?page=1&page=2",
	"/releases/stable%",
	"/releases/stable?label=%ZZ",
	"/releases/stable?label=%A",
]) {
	assert.equal(inspectRequestTarget(invalid), null);
}

{
	const input = "https://example.test/releases/beta?page=3&label=one&label=two";
	const first = inspectRequestTarget(input);
	const second = inspectRequestTarget(input);

	assert.deepEqual(Object.keys(first), ["channel", "page", "labels"]);
	assert.notEqual(first, second);
	assert.notEqual(first.labels, second.labels);
	first.channel = "stable";
	first.page = 99;
	first.labels.splice(0);
	assert.deepEqual(inspectRequestTarget(input), {
		channel: "beta",
		page: 3,
		labels: ["one", "two"],
	});
}
