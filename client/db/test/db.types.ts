import type { DB, DBEntry, StoreKey, StoreValue } from "../src/client-db.js";
import type * as DBTypes from "../src/lib/.types.js";

interface Schema {
	users: DB.Store<{ id: string; name: string }, string, { byName: string }>;
	logs: DB.Store<string, number>;
}

export type PublicTypesInTypesModule = [
	DBTypes.DBStore,
	DBTypes.DBSchema,
	DBTypes.DBEntry<Schema["users"]>,
	DBTypes.DBIndex<Schema["users"], "byName">,
	DBTypes.DBObjectStore<Schema["users"]>,
	DBTypes.DBTransaction<Schema, "users">,
	DBTypes.StoreName<Schema>,
	DBTypes.StoreKey<Schema["users"]>,
	DBTypes.StoreValue<Schema["users"]>,
	DBTypes.DBOpenOptions<Schema>,
	DBTypes.DBDeleteOptions,
	DBTypes.DBOperationOptions,
	DBTypes.DBMutationOptions,
	DBTypes.DBWriteOptions<Schema["users"]>,
	DBTypes.DBTransactionOptions,
	DBTypes.DBQueryOptions<string>,
	DBTypes.DBGetAllOptions<Schema["users"]>,
	DBTypes.DBCountOptions<Schema["users"]>,
	DBTypes.DBScanOptions<Schema["users"]>,
	DBTypes.DBUpgradeContext<Schema>,
	DBTypes.DBUpgradeDatabase<Schema>,
	DBTypes.DBUpgradeObjectStore<Schema["users"]>,
	DBTypes.DBUpgradeTransaction<Schema>,
	DBTypes.DBTransactionCallback<Schema, "users", void>,
];

declare const db: DB<Schema>;

const user: Promise<{ id: string; name: string } | undefined> = db.get("users", "1");
const keys: Promise<string[]> = db.getAllKeys("users", { count: 10 });
const scan: AsyncGenerator<DBEntry<Schema["users"]>, void, undefined> = db.scan("users");
const userKey: StoreKey<Schema["users"]> = "1";
const logValue: StoreValue<Schema["logs"]> = "started";

db.transaction(["users", "logs"], { mode: "readwrite" }, async (transaction) => {
	await transaction.objectStore("users").put({ id: "1", name: "Ada" });
	const indexed: { id: string; name: string } | undefined = await transaction
		.objectStore("users")
		.index("byName")
		.get("Ada");

	return indexed;
});

// @ts-expect-error unknown object store
db.get("missing", "1");
// @ts-expect-error key does not match the object store schema
db.get("users", 1);
// @ts-expect-error value does not match the object store schema
db.put("logs", { message: "started" });
// @ts-expect-error transaction only exposes the selected stores
db.transaction("users", {}, (transaction) => transaction.objectStore("logs"));

void user;
void keys;
void scan;
void userKey;
void logValue;
