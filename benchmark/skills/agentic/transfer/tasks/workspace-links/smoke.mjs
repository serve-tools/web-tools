import { assert, loadSolution } from "../_shared.mjs";

const { createWorkspaceLinks } = await loadSolution();
const links = createWorkspaceLinks();

assert.equal(
	links.build("board", { params: { teamId: 7, boardId: 9 }, search: { lane: ["todo", "doing"] } }),
	"/teams/7/boards/9?lane=todo&lane=doing",
);
assert.deepEqual(links.inspect("https://example.test/teams/7/boards/9?mode=cards&lane=a&x=ignored"), {
	kind: "board",
	params: { teamId: 7, boardId: 9 },
	search: { mode: "cards", lane: ["a"], focus: undefined },
	canonicalHref: "/teams/7/boards/9?lane=a",
});
assert.deepEqual(links.inspect(new URL("https://example.test/teams/3/invite/hello%20world?role=editor")), {
	kind: "invite",
	params: { teamId: 3, token: "hello world" },
	search: { role: "editor" },
	canonicalHref: "/teams/3/invite/hello%20world?role=editor",
});
assert.equal(links.inspect("/teams/01/boards/2"), null);
assert.equal(links.inspect("/elsewhere"), null);
assert.throws(() => links.build("missing", {}), TypeError);
assert.throws(() => links.build("board", { params: { teamId: 0, boardId: 1 }, search: { lane: [] } }), TypeError);
assert.throws(() => links.build("invite", { params: { teamId: 1, token: "ok" }, search: { role: null } }), TypeError);
