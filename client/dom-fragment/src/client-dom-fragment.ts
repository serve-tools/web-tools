const regions = new WeakMap<Node, PersistentFragment>();

/** A reusable DOM region that preserves node identity and tracks edits between its boundaries. */
export class PersistentFragment {
	#start: Comment;
	#end: Comment;
	#storage: DocumentFragment;
	#hidden: DocumentFragment | undefined;
	#busy = false;

	/** Finds a region by its start boundary or active hidden storage, not by arbitrary descendants. */
	static fromNode(node: Node): PersistentFragment | undefined {
		return regions.get(node);
	}

	/** Creates a detached region; native DocumentFragment inputs contribute their children. */
	constructor(nodes: Iterable<Node> = [], ownerDocument: Document = document) {
		this.#storage = ownerDocument.createDocumentFragment();
		this.#start = ownerDocument.createComment("");
		this.#end = ownerDocument.createComment("");
		this.#storage.appendChild(this.#start);
		for (const node of Array.from(nodes)) {
			this.#storage.appendChild(node);
		}
		this.#storage.appendChild(this.#end);
		regions.set(this.#start, this);
	}

	/** A snapshot of the current content, excluding this region's boundary comments. */
	get nodes(): Node[] {
		this.#assertIdle();
		this.#assertBoundaries();
		if (this.#hidden) {
			return Array.from(this.#hidden.childNodes);
		}
		const nodes: Node[] = [];
		for (let node = this.#start.nextSibling; node && node !== this.#end; node = node.nextSibling) {
			nodes.push(node);
		}
		return nodes;
	}

	/** Whether content is parked outside the region while its boundaries retain their position. */
	get hidden(): boolean {
		return this.#hidden !== undefined;
	}

	set hidden(value: boolean) {
		this.#assertIdle();
		if (Boolean(value) === this.hidden) {
			return;
		}
		this.#assertBoundaries();

		this.#busy = true;
		try {
			if (value) {
				this.#hidden = this.#start.ownerDocument.createDocumentFragment();
				regions.set(this.#hidden, this);
				this.#extract(this.#start.nextSibling, this.#end, this.#hidden);
			} else {
				this.#end.before(this.#hidden!);
				regions.delete(this.#hidden!);
				this.#hidden = undefined;
			}
		} finally {
			this.#busy = false;
		}
	}

	/** Inserts or moves the whole region; omitting before appends it. */
	insertBefore(parent: Element | DocumentFragment, before: Node | null = null): void {
		this.#assertIdle();
		this.#assertBoundaries();
		if (before !== null && before.parentNode !== parent) {
			throw new DOMException("The reference node is not a child of the destination.", "NotFoundError");
		}
		if (parent === this.#start.parentNode && (before === this.#start || before === this.#end.nextSibling)) {
			return;
		}

		if (parent === this.#hidden) {
			throw new DOMException("The destination holds this fragment's hidden content.", "HierarchyRequestError");
		}
		for (let destination: Node | null = parent; destination; ) {
			for (
				let node = this.#hidden ? this.#hidden.firstChild : this.#start.nextSibling;
				node && node !== this.#end;
				node = node.nextSibling
			) {
				if (node.contains(destination) || node === before) {
					throw new DOMException("The destination is inside this fragment.", "HierarchyRequestError");
				}
			}
			const root = destination.getRootNode();
			const region = regions.get(root);
			destination = region ? region.#start : "host" in root ? (root as ShadowRoot).host : null;
		}
		if (before === this.#end) {
			throw new DOMException("The reference node is a fragment boundary.", "HierarchyRequestError");
		}

		this.#busy = true;
		try {
			this.#detach();
			parent.insertBefore(this.#storage, before);
		} finally {
			this.#busy = false;
		}
	}

	/** Detaches the whole region for reuse, preserving its visibility and current contents. */
	remove(): void {
		this.#assertIdle();
		this.#assertBoundaries();
		this.#busy = true;
		try {
			this.#detach();
		} finally {
			this.#busy = false;
		}
	}

	#detach(): void {
		if (this.#start.parentNode === this.#storage) {
			return;
		}

		this.#storage = this.#extract(this.#start, this.#end.nextSibling);
	}

	#extract(
		node: ChildNode | null,
		stop: ChildNode | null,
		content = this.#start.ownerDocument.createDocumentFragment(),
	): DocumentFragment {
		while (node && node !== stop) {
			const next = node.nextSibling;
			content.appendChild(node);
			node = next;
		}
		return content;
	}

	#assertBoundaries(): void {
		if (
			!this.#start.parentNode ||
			this.#start.parentNode !== this.#end.parentNode ||
			!(this.#start.compareDocumentPosition(this.#end) & Node.DOCUMENT_POSITION_FOLLOWING)
		) {
			throw new DOMException("The fragment boundaries were removed or reordered.", "InvalidStateError");
		}
	}

	#assertIdle(): void {
		if (this.#busy) {
			throw new DOMException("A fragment mutation is already in progress.", "InvalidStateError");
		}
	}
}
