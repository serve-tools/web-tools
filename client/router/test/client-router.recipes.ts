import { codec, createRouter, route } from "../src/client-router.js";

const home = route("/");
const login = route("/login");
const projectId = codec.integer();
const project = route("/projects/:projectId", {
	params: { projectId },
	search: {
		parentId: projectId.optional(),
		tab: codec.enum("overview", "files").default("overview"),
	},
	loading: {
		mode: "blocking",
		load: async ({ params, signal }) => {
			const response = await fetch(`/api/projects/${params.projectId}`, { signal });
			return response.json() as Promise<{ name: string }>;
		},
	},
});
declare const session: { readonly user: boolean };

const publicRoutes = [home, login] as const;
const privateRoutes = [home, project] as const;
const router = createRouter({
	routes: session.user ? privateRoutes : publicRoutes,
	render({ current }) {
		document
			.querySelector("main")
			?.replaceChildren(
				document.createTextNode(current.status === "loading" ? "Loading…" : JSON.stringify(current.data)),
			);
	},
});

await router.start();
router.setRoutes(session.user ? privateRoutes : publicRoutes);
const { committed, finished } = router.navigate(project, { params: { projectId: 42 } });
await committed;
await finished;
