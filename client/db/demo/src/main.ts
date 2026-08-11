/// <reference lib="dom" />

import type { DB } from "@serve-tools/client-db";
import {
	type Contact,
	clearDemoData,
	type DemoSchema,
	database,
	ensureExamples,
	resetDemoData,
	seedContacts,
} from "./database.js";

const query = <ElementType extends Element>(selector: string): ElementType => {
	const element = document.querySelector<ElementType>(selector);

	if (!element) throw new Error(`Missing demo element: ${selector}`);

	return element;
};

const output = query<HTMLOutputElement>("output");

const show = (message: string): void => {
	output.value = message;
};

const describeError = (error: unknown): string =>
	error instanceof Error ? `${error.name}: ${error.message}` : String(error);

const showError = (error: unknown): void => show(describeError(error));

const listen = (element: Element, type: string, listener: (event: Event) => void | Promise<void>): void => {
	element.addEventListener(type, async (event) => {
		try {
			await listener(event);
		} catch (error) {
			showError(error);
		}
	});
};

const formatContacts = (contacts: readonly Contact[]): string =>
	contacts.length === 0
		? "No contacts stored."
		: contacts.map(({ email, name, visits }) => `${name} · ${email} · ${visits} visit(s)`).join("\n");

const showContacts = async (db: DB<DemoSchema>): Promise<void> => {
	show(formatContacts(await db.getAll("contacts")));
};

const setupOperations = async (db: DB<DemoSchema>): Promise<void> => {
	const form = query<HTMLFormElement>("form");
	const name = query<HTMLInputElement>("#name");
	const email = query<HTMLInputElement>("#email");

	listen(form, "submit", async (event) => {
		event.preventDefault();
		await db.add("contacts", {
			id: crypto.randomUUID(),
			email: email.value,
			name: name.value,
			visits: 0,
		});
		form.reset();
		await showContacts(db);
	});

	listen(query("#reset"), "click", async () => {
		await resetDemoData(db);
		await showContacts(db);
	});

	listen(query("#clear"), "click", async () => {
		await clearDemoData(db);
		await showContacts(db);
	});

	await ensureExamples(db);
	await showContacts(db);
};

const showTransactionStatus = async (db: DB<DemoSchema>): Promise<void> => {
	const [contact, activityCount] = await db.transaction(["contacts", "activity"], {}, (transaction) =>
		Promise.all([transaction.objectStore("contacts").get("ada"), transaction.objectStore("activity").count()]),
	);

	show(
		contact
			? `${contact.name} has ${contact.visits} recorded visit(s).\nActivity records: ${activityCount}.`
			: "Ada is missing.",
	);
};

const setupTransactions = async (db: DB<DemoSchema>): Promise<void> => {
	await ensureExamples(db);
	await showTransactionStatus(db);

	listen(query("#visit"), "click", async () => {
		await db.transaction(["contacts", "activity"], { mode: "readwrite" }, async (transaction) => {
			const contacts = transaction.objectStore("contacts");
			const current = await contacts.get("ada");

			if (!current) throw new Error("Ada is missing from the contact store.");

			const next = { ...current, visits: current.visits + 1 };

			await contacts.put(next);
			await transaction.objectStore("activity").add({
				contactID: next.id,
				time: Date.now(),
			});
		});
		await showTransactionStatus(db);
	});

	listen(query("#reset"), "click", async () => {
		await resetDemoData(db);
		await showTransactionStatus(db);
	});
};

const setupScans = async (db: DB<DemoSchema>): Promise<void> => {
	const seed = async (): Promise<void> => {
		show("Seeding 60 contacts…");
		await seedContacts(db, 60);
		show("60 contacts are ready to scan.");
	};

	listen(query("#seed"), "click", seed);
	listen(query("form"), "submit", async (event) => {
		event.preventDefault();

		const direction = query<HTMLSelectElement>("#direction").value as "next" | "prev";
		const limit = query<HTMLInputElement>("#limit").valueAsNumber;
		const contacts: Contact[] = [];

		for await (const contact of db.scanValues("contacts", { batchSize: 5, direction, limit })) {
			contacts.push(contact);
		}

		show(
			`Scanned ${contacts.length} record(s) in ${direction === "next" ? "forward" : "reverse"} order.\n\n${formatContacts(contacts)}`,
		);
	});

	await seed();
};

const delay = (duration: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, duration));

const setupCancellation = async (db: DB<DemoSchema>): Promise<void> => {
	const start = query<HTMLButtonElement>("#start");
	const cancel = query<HTMLButtonElement>("#cancel");
	let controller: AbortController | undefined;

	await seedContacts(db, 60);
	show("60 contacts are ready. Start the slow scan, then abort it.");

	listen(start, "click", async () => {
		controller?.abort();
		controller = new AbortController();
		start.disabled = true;
		cancel.disabled = false;

		let count = 0;

		try {
			for await (const _contact of db.scanValues("contacts", {
				batchSize: 1,
				signal: controller.signal,
			})) {
				++count;
				show(`Scanned ${count} contact(s)…`);
				await delay(100);
			}

			show(`Scan completed with ${count} contacts.`);
		} catch (error) {
			show(`${describeError(error)}\nStopped after ${count} contact(s).`);
		} finally {
			controller = undefined;
			start.disabled = false;
			cancel.disabled = true;
		}
	});

	listen(cancel, "click", () => controller?.abort(new DOMException("Scan cancelled", "AbortError")));
};

const setups: Record<string, (db: DB<DemoSchema>) => Promise<void>> = {
	operations: setupOperations,
	transactions: setupTransactions,
	scans: setupScans,
	cancellation: setupCancellation,
};
const setup = setups[document.body.dataset.demo ?? ""];

if (setup) void database.then(setup).catch(showError);

addEventListener(
	"pagehide",
	() => {
		void database.then(
			(db) => db.close(),
			() => {},
		);
	},
	{ once: true },
);
