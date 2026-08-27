export interface paths {
    "/items/{itemId}": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                itemId: number;
            };
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["replaceItem"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
}
export type webhooks = Record<string, never>;
export interface components {
    schemas: never;
    responses: never;
    parameters: never;
    requestBodies: never;
    headers: never;
    pathItems: never;
}
export type $defs = Record<string, never>;
export interface operations {
    replaceItem: {
        parameters: {
            query?: {
                tag?: string[];
            };
            header?: never;
            path: {
                itemId: number;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    title: string;
                };
            };
        };
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        id: number;
                        title: string;
                        tags: string[];
                    };
                };
            };
            /** @description Bad Request */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        /** @constant */
                        error: "invalid_request";
                    };
                };
            };
            /** @description Content Too Large */
            413: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        /** @constant */
                        error: "request_too_large";
                    };
                };
            };
            /** @description Unsupported Media Type */
            415: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        /** @constant */
                        error: "unsupported_media_type";
                    };
                };
            };
        };
    };
}
