# Recipe: quick start

This public-import example is generated from the compile-checked `test/router.recipes.ts` fixture in the package source.

```ts
import { codec, route } from "@serve-tools/router";

const projectId = codec.integer();

const projectRoute = route("/projects/:id", {
	params: { id: projectId },
	search: {
		parentId: projectId.optional(),
		tab: codec.enum("overview", "files").default("overview"),
		tags: codec.string().many(),
		q: codec.string().optional(),
	},
	loading: { mode: "blocking" },
});

export const projectURL = projectRoute.href({ params: { id: 42 } });
export const projectMatch = projectRoute.match(projectURL);
```
