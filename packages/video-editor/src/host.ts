import type { IPreviewVideoCache } from "./render/preview-cache/preview-video-cache-contract.js";
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
	/** Undo and redo keys, Escape layers and key suppression. Default: one window keydown listener. */
	shortcuts?: EditorShortcuts;
	/** Vibration on a phone. Default: none. */
	haptics?: EditorHaptic;
}

export interface EditorNotify {
	success(message: string): void;
	error(message: string): void;
	info(message: string): void;
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
