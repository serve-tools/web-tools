import type {
	RouterCurrent,
	RouterInterceptOptions,
	RouterNavigationResult,
	RouterRenderOptions,
} from "../src/client-router.js";
import { codec, createRouter, route } from "../src/client-router.js";

const home = route("/");
const identifier = codec.integer();
const project = route("/projects/:projectId", {
	params: { projectId: identifier },
	search: {
		parentId: identifier.optional(),
		tab: codec.enum("overview", "files").default("overview"),
	},
	loading: {
		mode: "deferred",
		load: async ({ params, search, signal }) => {
			signal.throwIfAborted();
			return { id: params.projectId, tab: search.tab };
		},
	},
});
const settings = route("/settings");
const incompatibleProject = route("/projects/:projectId", {
	params: { projectId: codec.string() },
	search: {
		parentId: codec.string().optional(),
		tab: codec.enum("recent", "archived").default("recent"),
	},
});
const publicRoutes = [home] as const;
const privateRoutes = [home, project] as const;
const authenticated = true as boolean;
const router = createRouter({
	routes: authenticated ? privateRoutes : publicRoutes,
	render({ current }) {
		const value: RouterCurrent<typeof home | typeof project> = current;
		if (current.status === "loading") {
			const pending: undefined = current.data;
			void pending;
		}
		void value;
	},
});

router.navigate(home);
const result: RouterNavigationResult = router.navigate(
	project,
	{ params: { projectId: 42 }, search: { tab: "files" } },
	{ history: "replace" },
);
router.setRoutes(authenticated ? privateRoutes : publicRoutes);
router.setRoutes(publicRoutes, { unmatched: { mode: "redirect", route: home } });
router.match("/projects/42");
router.navigate(authenticated ? home : project, { params: { projectId: 42 } });

// @ts-expect-error Project identifiers use the integer codec.
router.navigate(project, { params: { projectId: "42" } });
// @ts-expect-error Routes outside the inferred conditional route-list union cannot be installed.
router.setRoutes([settings]);
// @ts-expect-error Routes outside the inferred conditional route-list union cannot be navigated to.
router.navigate(settings);
// @ts-expect-error An identical pathname does not make incompatible parameter and search codecs an installed route.
router.navigate(incompatibleProject, { params: { projectId: "42" }, search: { tab: "recent" } });
// @ts-expect-error Route unions that contain an uninstalled route cannot be navigated to.
router.navigate(authenticated ? home : settings);
// @ts-expect-error Router construction accepts only a route list.
createRouter({ routes: { home, project } });
// @ts-expect-error Navigation belongs to the current global realm and cannot be supplied as a router option.
createRouter({ navigation: {} as Navigation, routes: publicRoutes });
// @ts-expect-error setRoutes accepts only route lists.
router.setRoutes({ home });
// @ts-expect-error Redirects to parameterized routes require their typed input.
createRouter({ routes: [project], unmatched: { mode: "redirect", route: project } });
createRouter({
	routes: [project],
	unmatched: { mode: "redirect", route: project, input: { params: { projectId: 42 } } },
});
createRouter({
	routes: publicRoutes,
	// @ts-expect-error Redirect routes must belong to the inferred route-list union.
	unmatched: { mode: "redirect", route: project, input: { params: { projectId: 42 } } },
});
const homeAndSettingsRender = (_options: RouterRenderOptions<typeof home | typeof settings>): void => undefined;
const publicRouter = createRouter({ routes: publicRoutes, render: homeAndSettingsRender });
// @ts-expect-error A render annotation cannot widen the inferred route-list union.
publicRouter.navigate(settings);

createRouter({
	routes: [project],
	shouldIntercept({ match, event }) {
		const native: NavigateEvent = event;
		const id: number | undefined = match?.params.projectId;
		const tab: "overview" | "files" | undefined = match?.search.tab;
		void native;
		void tab;
		// @ts-expect-error Interception receives decoded numeric pathname values.
		const wrong: string | undefined = match?.params.projectId;
		void wrong;
		return id === 42;
	},
});
createRouter({
	routes: [home, project],
	shouldIntercept({ match }) {
		if (match?.path !== project.path) {
			return true;
		}
		match.params.projectId satisfies number;
		match.search.tab satisfies "overview" | "files";
		// @ts-expect-error The matched project route retains its numeric parameter codec.
		match.params.projectId satisfies string;
		return match.params.projectId === 42;
	},
});
const selectedMatch = router.match("/projects/42");
if (selectedMatch?.path === project.path) {
	selectedMatch.params.projectId satisfies number;
}
createRouter({
	routes: [project],
	// @ts-expect-error The browser requires an interception decision before the event returns.
	shouldIntercept: async () => true,
});
const homeAndSettingsIntercept = (_options: RouterInterceptOptions<typeof home | typeof settings>): boolean => true;
const scopedRouter = createRouter({ routes: publicRoutes, shouldIntercept: homeAndSettingsIntercept });
// @ts-expect-error An interception annotation cannot widen the inferred route-list union.
scopedRouter.navigate(settings);

void result;
