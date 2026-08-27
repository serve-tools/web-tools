import type createClient from "openapi-fetch";
import type { paths } from "../generated/openapi.js";

declare const client: ReturnType<typeof createClient<paths>>;

void client.POST("/items/{itemId}", {
	params: { path: { itemId: 7 }, query: { tag: ["first", "second"] } },
	body: { title: "Saved" },
});

// @ts-expect-error pathname parameters are required
void client.POST("/items/{itemId}", { body: { title: "Saved" } });
// @ts-expect-error pathname parameters use the projected safe-integer number type
void client.POST("/items/{itemId}", { params: { path: { itemId: "7" } }, body: { title: "Saved" } });
// @ts-expect-error request bodies retain required properties
void client.POST("/items/{itemId}", { params: { path: { itemId: 7 } }, body: {} });
