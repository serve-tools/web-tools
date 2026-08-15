import { DB } from "@serve-tools/client-db";

export interface Contact {
	readonly id: string;
	readonly email: string;
	readonly name: string;
	readonly visits: number;
}

interface Activity {
	readonly contactID: string;
	readonly time: number;
}

export interface DemoSchema {
	contacts: DB.Store<Contact, string, { byEmail: string }>;
	activity: DB.Store<Activity, number>;
}

const exampleContacts: readonly Contact[] = [
	{ id: "ada", email: "ada@example.com", name: "Ada Lovelace", visits: 0 },
	{ id: "grace", email: "grace@example.com", name: "Grace Hopper", visits: 0 },
	{ id: "katherine", email: "katherine@example.com", name: "Katherine Johnson", visits: 0 },
];

export const database = DB.open<DemoSchema>("serve-tools-client-db-demo", {
	version: 1,
	upgrade(source) {
		const contacts = source.createObjectStore("contacts", { keyPath: "id" });

		contacts.createIndex("byEmail", "email", { unique: true });
		source.createObjectStore("activity", { autoIncrement: true });
	},
});

const replaceContacts = (db: DB<DemoSchema>, contacts: readonly Contact[]): Promise<void> =>
	db.transaction(["contacts", "activity"], { mode: "readwrite" }, async (transaction) => {
		const contactStore = transaction.objectStore("contacts");

		await Promise.all([contactStore.clear(), transaction.objectStore("activity").clear()]);
		await Promise.all(contacts.map((contact) => contactStore.add(contact)));
	});

export const clearDemoData = (db: DB<DemoSchema>): Promise<void> => replaceContacts(db, []);

export const ensureExamples = (db: DB<DemoSchema>): Promise<void> =>
	db.transaction("contacts", { mode: "readwrite" }, async (transaction) => {
		const contacts = transaction.objectStore("contacts");

		for (const contact of exampleContacts) {
			if (!(await contacts.has(contact.id))) {
				await contacts.add(contact);
			}
		}
	});

export const resetDemoData = (db: DB<DemoSchema>): Promise<void> => replaceContacts(db, exampleContacts);

export const seedContacts = (db: DB<DemoSchema>, count: number): Promise<void> => {
	const contacts = Array.from({ length: count }, (_, index): Contact => {
		const number = String(index + 1).padStart(2, "0");

		return {
			id: `contact-${number}`,
			email: `contact-${number}@example.com`,
			name: `Contact ${number}`,
			visits: index % 8,
		};
	});

	return replaceContacts(db, contacts);
};
