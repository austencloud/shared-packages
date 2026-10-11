import type { IPreviewVideoCache } from "./render/preview-cache/preview-video-cache-contract.js";
import type { PostFootageVault } from "./state/local-footage-vault.js";
import type { VideoEditorState } from "./state/video-editor-state.svelte.js";
import type { VideoEditorStore } from "./store/types.js";
import type { Translate } from "./strings/translate.js";

/** What an app gives the editor. Everything but ownerId has a default. */
export interface VideoEditorHost<E = unknown> {
	/**
	 * Whose projects these are. Read at every store call, so a getter may follow sign-in.
	 * Scopes the device store's keys (it replaces the auth.currentUser reads).
	 */
	readonly ownerId: string;
	/** Where projects and history live. Default: createDeviceStore() with no plugin. */
	store?: VideoEditorStore<E>;
	/** The take library a picker lists (2B reads it; the 2A state uses options.libraryTake). */
	mediaLibrary?: MediaLibrary;
	/** Replaces t(). Default: the English table in strings/en.ts. */
	translate?: Translate;
	/** Default: Date.now. */
	now?: () => number;
	/** Development-only behaviour; replaces import.meta.env.DEV in moved code. */
	dev?: boolean;
	/** The app-wide preview video cache the previews read. Default: an unsupported cache, so takes play their original files. */
	previewCache?: IPreviewVideoCache;
	/** Toasts. Default: silent, or the console when `dev` is true. */
	notify?: EditorNotify;
	/** An outside keeper of the project beside the store. Default: none. */
	sync?: EditorSync;
	/** Undo and redo keys, Escape layers and key suppression. Default: one window keydown listener. */
	shortcuts?: EditorShortcuts;
	/** Vibration on a phone. Default: none. */
	haptics?: EditorHaptic;
	/**
	 * This device's kept copies of picked videos, for whoever is editing, so a reload brings device
	 * footage back without picking it again (createLocalFootageVault). Default: none.
	 */
	footage?: PostFootageVault;
	/**
	 * Confirmations a person may turn off (tka: its settings' "don't ask again"). Absent: the editor
	 * always asks and offers no way to stop.
	 */
	confirmations?: EditorConfirmations;
}

/** A confirmation the person can turn off, keyed by the editor's name for it. */
export interface EditorConfirmations {
	/** Whether to ask before this action. */
	shouldAsk(key: EditorConfirmKey): boolean;
	/** The person ticked "don't ask again". */
	stopAsking(key: EditorConfirmKey): void;
}

/** The editor's confirmations a host may let a person turn off. */
export type EditorConfirmKey = "clear-post-keyframes";

export interface EditorNotify {
	success(message: string): void;
	error(message: string): void;
	info(message: string): void;
	/**
	 * A success notice with one action (tka: "Removed 3 keyframes" with Undo). Returns the dismiss, which the
	 * editor calls when the action no longer applies. Absent: the editor says the message through `success`.
	 */
	undoable?(message: string, action: { label: string; run(): void }): () => void;
}

/** Where a kept render landed, as the host names it (tka: exports/<name>.mp4 inside the feature's folder). */
export interface KeptExport {
	file: string;
}

/**
 * An outside keeper of the project beside the store (tka: a feature video's folder on disk, through
 * the dev server). Absent: the project lives in the store and syncs between tabs through the browser.
 */
export interface EditorSync {
	/** Watches the outside copy. onReplaced runs after a newer copy was adopted into the editor. Returns the stop. */
	connect(editor: VideoEditorState, onReplaced: () => void): () => void;
	/** Keeps a finished render outside the browser and resolves with where it landed. Absent: renders stay in the browser. */
	keepExport?(
		blob: Blob,
		name: string | undefined,
		signal: AbortSignal | undefined,
	): Promise<KeptExport>;
	/** Set when device videos are refused: the message the media panel shows instead of opening the picker. */
	devicePickBlocked?: string;
	/** False: no browser tab sync for this project, because the sync keeps every copy current itself. Default true. */
	tabSync?: boolean;
}

export interface EditorShortcuts {
	/**
	 * Undo and redo keys while focus is in the editor. `scope` is an element the editor renders inside its section
	 * (`EditHistoryKeys.svelte`); a host may mount its own key targets there (tka: the undo bridge).
	 * Returns the unregister.
	 */
	editHistory(
		handlers: {
			undo(): void;
			redo(): void;
			canUndo(): boolean;
			canRedo(): boolean;
		},
		scope: HTMLElement,
	): () => void;
	/** Escape closes the topmost layer first (drawers, dialogs, the crop screen). Returns the unregister. */
	escapeLayer(id: string, close: () => void): () => void;
	/** While test(event) is true the key is not a shortcut (a drag owns Escape). Returns the unregister. */
	suppress(test: (event: KeyboardEvent) => boolean): () => void;
}

export type EditorHaptic = (kind: "selection" | "success" | "warning") => void;

export interface LibraryTake {
	id: string;
	label: string;
	url: string;
	durationSeconds: number;
	/** A short note the library list shows after the duration (tka: "timing saved"). */
	detail?: string;
}

export interface MediaLibrary {
	listTakes(): Promise<LibraryTake[]>;
	resolveTake(id: string): Promise<LibraryTake | null>;
	/** Rewrites or re-requests a media URL so fetch and decode succeed (proxy, cache: "no-store"). */
	requestFor(url: string): Request;
	/** Calls the listener whenever the list may have changed; returns the unsubscribe. */
	onChange?(listener: () => void): () => void;
}
