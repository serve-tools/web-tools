# @serve-tools/client-router

`@serve-tools/client-router` combines unnamed strongly typed route declarations with the browser Navigation API.
By default, it intercepts destinations matched by the installed route array and preserves native `committed` and `finished` promises.
The router uses its current browser realm's `navigation`, `document`, `URLPattern`, and `reportError` globals.
Install any missing Navigation API or `URLPattern` polyfills globally before creating a router; compatibility fallbacks are never bundled.

## Install

```shell
npm install @serve-tools/client-router
```

## Define and start a router

```ts
import { codec, createRouter, route } from "@serve-tools/client-router";

const home = route("/");
const projectId = codec.integer();
const project = route("/projects/:projectId", {
	params: { projectId },
	search: {
		parentId: projectId.optional(),
		tab: codec.enum("overview", "files").default("overview"),
		tags: codec.string().many(),
	},
	loading: {
		mode: "blocking",
		load: async ({ params, signal }) => {
			const response = await fetch(`/api/projects/${params.projectId}`, { signal });

			return response.json() as Promise<{ name: string }>;
		},
	},
});
const router = createRouter({
	routes: [home, project],
	render({ current }) {
		const main = document.querySelector("main");

		if (main === null) {
			return;
		}

		main.textContent = current.status === "loading" ? "Loading…" : JSON.stringify(current.data);
	},
});

await router.start();
```

Routes are an application-owned ordered array.
Route declarations remain unnamed and can be shared with server integrations.
The same `codec` declarations describe required pathname values and optional, defaulted, or repeated search values.
When created inside an iframe, the router uses that iframe's own browser globals.

Call `start()` to attach interception and present the current history entry.
`start()` is idempotent, and `stop()` detaches interception and aborts router-owned work while allowing a later restart.
`dispose()` stops the router, removes its subscriptions, and permanently prevents restart.

## Navigate with native phases

```ts
const { committed, finished } = router.navigate(project, {
	params: { projectId: 42 },
	search: { tab: "files" },
});

await committed;
await finished;
```

`navigate()` returns the object produced by `Navigation.navigate()` without wrapping its promises.
`committed` resolves when the native history entry and URL commit.
`finished` includes route loading, rendering, scrolling, and any automatic same-document View Transition animation.
Navigation to a route that is not installed throws synchronously.

Reloads, hash-only, download, form-data, cross-origin, non-HTTP, and non-interceptable navigations retain browser handling.

## Leave application-scope changes to the browser

When switching a project or account must reboot document-owned stores, decline same-document interception:

```ts
const project = route("/projects/:projectId");
const router = createRouter({
	routes: [home, project],
	shouldIntercept({ match }) {
		if (match?.path !== project.path) return true;
		return match.params.projectId === activeProjectId;
	},
});
```

`shouldIntercept({ match, event })` is synchronous and receives decoded route inputs plus the native `NavigateEvent`.
In mixed route arrays, compare the declared `match.path` to narrow its parameters and search values; route-object equality alone is not a TypeScript discriminant.
Returning `false` leaves the event untouched for normal document navigation or another router; it does not cancel navigation or authorize access.
The callback runs before route loading and before any configured unmatched fallback, with `match: null` for an unmatched destination.
It does not run during `start()`, for native-only navigations, or for unmatched destinations already using the `document` policy.
Read current application scope from a closure; native reloads always bypass interception regardless of this callback or the unmatched policy.

## Loading phases

Every loader receives one object containing `{ params, search, url, signal }`.
Always pass its signal to cancellable work.

`loading: { mode: "blocking", load }` uses a genuine Navigation API `precommitHandler` when the event is cancelable and the browser exposes `NavigationPrecommitController`.
In that case a rejected loader prevents the URL from committing.
On browsers or navigation types without precommit support, the same loader runs in the ordinary post-commit handler; the router does not claim equivalent commit timing.

`loading: { mode: "deferred", load }` commits first, presents `{ status: "loading", data: undefined }`, and then presents `{ status: "ready", data }` when the loader fulfills.
The native `finished` promise waits for both presentations.

## View Transitions, scrolling, and focus

Same-document View Transitions are automatic when `document.startViewTransition` is available.
The router does not start one when `NavigateEvent.hasUAVisualTransition` reports a browser-provided gesture transition.
Rendering and `NavigateEvent.scroll()` happen inside the update callback before the browser captures the new snapshot, and `finished` waits for the animation.
Cancellation calls `skipTransition()` and rejects through the native navigation lifecycle.

Matched routes retain the Navigation API focus-reset default of `"after-transition"`.
The `preserve` unmatched mode uses manual focus reset so retaining the current presentation does not unexpectedly move focus.
Control animation and reduced-motion behavior entirely in CSS.

## Replace routes and handle unmatched destinations

```ts
router.setRoutes([home]);

router.setRoutes(
	[home, project],
	{ unmatched: { mode: "redirect", route: home } },
);
```

Routes are matched in array order.
Replacing the installed array clears `current` when its route is no longer installed; it does not create an implicit navigation.
Use `match(url)`, `current`, and `subscribe()` to observe this state.

The optional `unmatched` policy defaults to `{ mode: "document" }`:

- `document` leaves the destination to normal document navigation.
- `preserve` converts it to a same-document navigation while retaining the current presentation.
- `redirect` redirects before commit where native precommit support exists, with a cancellation-and-replace fallback elsewhere.

For authentication, preserve the route union with `as const` arrays and replace the installed array when session state changes:

```ts
const login = route("/login");
const publicRoutes = [home, login] as const;
const privateRoutes = [home, project] as const;
const router = createRouter({
	routes: session.user ? privateRoutes : publicRoutes,
});

router.setRoutes(session.user ? privateRoutes : publicRoutes);
```

## Migration to 0.2

Version 0.2 re-exports `@serve-tools/router` 0.2.
Successful matches now include the declared `path` discriminator, and router 0.2's stricter route construction, `href()` round-trip validation, codec metadata, and option snapshots apply here as well.

Native reload events now always remain browser-owned.
Remove application code that expected a reload to run a same-document loader or render cycle.

Use the new synchronous `shouldIntercept({ match, event })` option when a matched or configured unmatched navigation must remain browser-owned, such as an application-scope change that requires a new document.
It does not run for initial `start()` presentation, native-only events, or unmatched destinations already using the `document` policy, and it is not an authorization check.
