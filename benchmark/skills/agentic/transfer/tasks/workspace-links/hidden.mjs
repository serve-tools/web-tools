import { assert, loadSolution } from "../_shared.mjs";

const { createWorkspaceLinks } = await loadSolution();
const links = createWorkspaceLinks();

for (let seed = 1; seed <= 17; ++seed) {
	const teamId = seed * 7919;
	const boardId = seed * seed + 1;
	const lanes = [`lane ${seed}`, `x/${seed}`, `#${seed}`];
	const href = links.build("board", {
		params: { teamId, boardId },
		search: { mode: seed % 2 ? "table" : "cards", lane: lanes, focus: seed + 2 },
	});
	const match = links.inspect(href);

	assert.equal(match.kind, "board");
	assert.deepEqual(match.params, { teamId, boardId });
	assert.deepEqual(match.search, { mode: seed % 2 ? "table" : "cards", lane: lanes, focus: seed + 2 });
	assert.equal(match.canonicalHref, href);
}

for (const invalid of [0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1, null, "1"]) {
	assert.throws(
		() => links.build("board", { params: { teamId: invalid, boardId: 2 }, search: { lane: [] } }),
		TypeError,
	);
}
for (const search of [
	{ mode: null, lane: [] },
	{ mode: "cards", lane: null },
	{ mode: "cards", lane: [], focus: null },
]) {
	assert.throws(() => links.build("board", { params: { teamId: 1, boardId: 2 }, search }), TypeError);
}
for (const invalid of [
	"/teams/1/boards/2?focus=01",
	"/teams/1/boards/2?focus=2&focus=3",
	"/teams/1/boards/2?mode=cards&mode=table",
	"/teams/9007199254740992/boards/2",
	"ftp://example.test/teams/1/boards/2",
]) {
	assert.equal(links.inspect(invalid), null);
}

assert.throws(() => links.build("invite", { params: { teamId: 1, token: "\ud800" }, search: {} }), TypeError);
assert.throws(() => links.build("invite", { params: { teamId: 1, token: ".." }, search: {} }), TypeError);
assert.throws(() => links.build("invite", { params: { teamId: 1, token: "." }, search: {} }), TypeError);
assert.deepEqual(links.inspect("/teams/4/invite/token?role=viewer&unknown=1"), {
	kind: "invite",
	params: { teamId: 4, token: "token" },
	search: { role: "viewer" },
	canonicalHref: "/teams/4/invite/token",
});
