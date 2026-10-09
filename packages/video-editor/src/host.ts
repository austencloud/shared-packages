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
	/** The app-wide preview video cache the previews read. Required by createVideoPreviews callers. */
	previewCache?: IPreviewVideoCache;
}

export interface LibraryTake {
	id: string;
	label: string;
	url: string;
	durationSeconds: number;
}

export interface MediaLibrary {
	listTakes(): Promise<LibraryTake[]>;
	resolveTake(id: string): Promise<LibraryTake | null>;
	/** Rewrites or re-requests a media URL so fetch and decode succeed (proxy, cache: "no-store"). */
	requestFor(url: string): Request;
}
