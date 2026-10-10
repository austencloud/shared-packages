import { afterEach, describe, expect, it, vi } from "vitest";
import { createProjectSchema, normalizeProject } from "../src/core/index.js";
import type { PostProject } from "../src/core/project/item-kinds.js";
import { createTabSync, type TabSync } from "../src/state/tab-sync.js";
import plain from "./fixtures/plain.project.json";

/** The part of BroadcastChannel the tab sync uses, with a way to deliver a message to it. */
class FakeChannel {
	static opened: FakeChannel[] = [];
	readonly listeners = new Set<(event: MessageEvent) => void>();
	readonly posted: unknown[] = [];

	constructor(readonly name: string) {
		FakeChannel.opened.push(this);
	}

	addEventListener(_type: "message", listener: (event: MessageEvent) => void): void {
		this.listeners.add(listener);
	}

	removeEventListener(_type: "message", listener: (event: MessageEvent) => void): void {
		this.listeners.delete(listener);
	}

	postMessage(data: unknown): void {
		this.posted.push(data);
	}

	close(): void {}

	deliver(data: unknown): void {
		for (const listener of this.listeners) listener({ data } as MessageEvent);
	}
}

const project = (): PostProject => normalizeProject(createProjectSchema().parse(plain));

const open: TabSync[] = [];

function start(channelName = "tab-sync-test") {
	const adopt = vi.fn<(project: PostProject) => void>();
	const readSaved = vi.fn<() => PostProject | null>(() => null);
	const sync = createTabSync(channelName, adopt, readSaved);
	open.push(sync);
	return { sync, adopt, channel: FakeChannel.opened.at(-1)! };
}

afterEach(() => {
	for (const sync of open.splice(0)) sync.dispose();
	FakeChannel.opened = [];
	vi.unstubAllGlobals();
});

describe("createTabSync", () => {
	it("opens the channel under exactly the name it is given", () => {
		vi.stubGlobal("BroadcastChannel", FakeChannel);
		start("post-sync-feature-promo");
		expect(FakeChannel.opened.map((channel) => channel.name)).toEqual(["post-sync-feature-promo"]);
	});

	it("adopts the project another tab announced", () => {
		vi.stubGlobal("BroadcastChannel", FakeChannel);
		const { adopt, channel } = start();
		const sent = project();
		channel.deliver({ tabId: "another-tab", project: JSON.stringify(sent) });
		expect(adopt).toHaveBeenCalledTimes(1);
		expect(adopt).toHaveBeenCalledWith(JSON.parse(JSON.stringify(sent)));
	});

	it("ignores the echo of its own announcement", () => {
		vi.stubGlobal("BroadcastChannel", FakeChannel);
		const { sync, adopt, channel } = start();
		sync.announce(project());
		expect(channel.posted).toHaveLength(1);
		const own = channel.posted[0] as { tabId: string; project: string };
		channel.deliver(own);
		expect(adopt).not.toHaveBeenCalled();
		// The same text from a different tab is adopted, so the echo was skipped by its tab id.
		channel.deliver({ ...own, tabId: "another-tab" });
		expect(adopt).toHaveBeenCalledTimes(1);
	});

	it("catches a garbled message and adopts nothing", () => {
		vi.stubGlobal("BroadcastChannel", FakeChannel);
		const { adopt, channel } = start();
		expect(() => channel.deliver({ tabId: "another-tab", project: "{not json" })).not.toThrow();
		expect(adopt).not.toHaveBeenCalled();
	});
});
