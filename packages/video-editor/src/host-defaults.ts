import type { PreviewVideoState } from "./core/preview-video.js";
import type {
	EditorHaptic,
	EditorNotify,
	EditorShortcuts,
	EditorSync,
	MediaLibrary,
	VideoEditorHost,
} from "./host.js";
import type { IPreviewVideoCache } from "./render/preview-cache/preview-video-cache-contract.js";

export interface EditorServices {
	notify: EditorNotify;
	shortcuts: EditorShortcuts;
	haptics: EditorHaptic;
	previewCache: IPreviewVideoCache;
	/** Null when the host has none: the editor shows no library section. */
	mediaLibrary: MediaLibrary | null;
	/** Null when the host has none: the project lives in the store and syncs between tabs. */
	sync: EditorSync | null;
}

/** The host's services, with the package defaults for any it leaves out. */
export function resolveServices<E>(host: VideoEditorHost<E>): EditorServices {
	return {
		notify: host.notify ?? consoleNotify(host.dev === true),
		shortcuts: host.shortcuts ?? createWindowShortcuts(),
		haptics: host.haptics ?? (() => {}),
		previewCache: host.previewCache ?? createUnsupportedPreviewCache(),
		mediaLibrary: host.mediaLibrary ?? null,
		sync: host.sync ?? null,
	};
}

/**
 * The preview cache for a host without one: it never makes a preview copy, so every handle is
 * already settled on the original file, the state the real cache falls back to.
 */
export function createUnsupportedPreviewCache(): IPreviewVideoCache {
	return {
		acquire(sourceUrl) {
			const state: PreviewVideoState = {
				status: "fallback",
				sourceUrl,
				url: sourceUrl,
				progress: 0,
				reason: "No preview cache",
			};
			return {
				getState: () => state,
				ready: Promise.resolve(state),
				subscribe: () => () => {},
				reportPlaybackError: () => {},
				release: () => {},
			};
		},
	};
}

function consoleNotify(dev: boolean): EditorNotify {
	return {
		success: (message) => {
			if (dev) console.info(message);
		},
		info: (message) => {
			if (dev) console.info(message);
		},
		error: (message) => {
			if (dev) console.error(message);
		},
	};
}

/** Keys typed into a field are text, not shortcuts. */
function typing(target: EventTarget | null): boolean {
	if (!(target instanceof HTMLElement)) return false;
	return (
		target.isContentEditable ||
		target instanceof HTMLInputElement ||
		target instanceof HTMLTextAreaElement ||
		target instanceof HTMLSelectElement
	);
}

interface HistoryHandlers {
	undo(): void;
	redo(): void;
	canUndo(): boolean;
	canRedo(): boolean;
}

interface History {
	handlers: HistoryHandlers;
	/** The element the editor registered from; its nearest edit-history scope is the editor. */
	scope: HTMLElement;
}

/** Focus is inside the history's editor, or on nothing at all. */
function owns(history: History): boolean {
	const focus = document.activeElement;
	if (focus === null || focus === document.body) return true;
	const region = history.scope.closest("[data-edit-history-shortcut-scope]") ?? history.scope;
	return region.contains(focus);
}

/**
 * One keydown listener on the document, there only while something is registered. Suppressors
 * run first; Escape closes the topmost layer; Ctrl or Cmd with Z undoes, with Shift+Z or Ctrl+Y
 * redoes, in the newest editor that holds focus, unless the key is typed into a field. The
 * editor claims those keys (preventDefault) whether or not it can act, so a host's window
 * listener that skips prevented events stays out of the editor's way.
 */
export function createWindowShortcuts(): EditorShortcuts {
	const histories: History[] = [];
	const layers: { id: string; close: () => void }[] = [];
	const suppressors: ((event: KeyboardEvent) => boolean)[] = [];
	let listening = false;

	function onKeydown(event: KeyboardEvent): void {
		if (suppressors.some((test) => test(event))) return;
		if (event.key === "Escape") {
			const top = layers.at(-1);
			if (!top) return;
			event.preventDefault();
			top.close();
			return;
		}
		const history = [...histories].reverse().find(owns)?.handlers;
		if (!history || typing(event.target) || !(event.ctrlKey || event.metaKey)) return;
		const key = event.key.toLowerCase();
		const redo =
			(key === "z" && event.shiftKey) || (key === "y" && event.ctrlKey && !event.metaKey);
		const undo = key === "z" && !event.shiftKey;
		if (!redo && !undo) return;
		// The editor owns its undo keys while it holds focus, even with nothing to undo, so a
		// page-wide undo on the window (Ringmaster's tag history) never acts unseen behind it.
		event.preventDefault();
		if (redo && history.canRedo()) history.redo();
		else if (undo && history.canUndo()) history.undo();
	}

	function sync(): void {
		const wanted = histories.length + layers.length > 0;
		// On the document, which hears a key before the window does.
		if (wanted && !listening) document.addEventListener("keydown", onKeydown);
		if (!wanted && listening) document.removeEventListener("keydown", onKeydown);
		listening = wanted;
	}

	function add<T>(list: T[], entry: T): () => void {
		list.push(entry);
		sync();
		return () => {
			const index = list.indexOf(entry);
			if (index >= 0) list.splice(index, 1);
			sync();
		};
	}

	return {
		editHistory: (handlers, scope) => add(histories, { handlers, scope }),
		escapeLayer: (id, close) => add(layers, { id, close }),
		suppress: (test) => add(suppressors, test),
	};
}
