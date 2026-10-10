import {
	compilePostProject,
	type CompiledPostProject,
	type CompilePostProjectContext,
} from "../core/compile/compiler.js";
import type { EditContext } from "../core/edit/context.js";
import {
	addOverlayItem,
	addTake,
	appendCardClip,
	appendVideoClip,
	cleanLabel,
	deleteItem,
	duplicateItem,
	removeTake as removeProjectTake,
	setProjectAudio,
	splitItemAt,
	trimItem,
	type NewOverlaySpec,
} from "../core/edit/project-edits.js";
import type { PostTake } from "../core/plan/post-plan.js";
import type { PostItem, PostProject } from "../core/project/item-kinds.js";
import { normalizeProject } from "../core/project/normalize.js";
import {
	POST_FRAME_RATE,
	POST_MIN_ITEM_SECONDS,
	POST_TIME_EPSILON,
	findItem,
	itemEnd,
	mainItemAt,
	projectDurationSeconds,
} from "../core/project/schema.js";
import { createProjectSchema } from "../core/project/schema-factory.js";
import { subjectKeyOf, subjectOf } from "../core/project/subject.js";
import { takeDisplayLabel } from "../core/project/take-labels.js";
import { libraryTakeKey, localTakeKey } from "../core/take-keys.js";
import type { VideoEditorHost } from "../host.js";
import type { VideoEditorPlugin } from "../plugin.js";
import type { FrameAlignment } from "../render/alignment.js";
import {
	evaluatePresetLayers,
	evaluateRegionRects,
	isVisibleLayer,
	type EvaluatedFrameLayer,
	type RegionRect,
} from "../render/frame-evaluator.js";
import { createDeviceStore } from "../store/device-store.js";
import type { HistoryEntry, StoreScope } from "../store/types.js";
import { translatorFor } from "../strings/translate.js";

/**
 * The timeline editor's working state: the project with its undo history,
 * each take's footage, the selection and the preview clock. The canvas, the
 * timeline, the inspector and the export all read it, so an edit in one
 * shows in all of them.
 *
 * The project saves through the host's store as it changes: this device by
 * default. The undo history is kept in the tab, so Undo still works after a
 * reload. Plugin state that rides along with the editor (tka: take timing)
 * is a per-instance extension, built once by options.extension.
 */

/** A library take's media, as the host's catalog answers synchronously. */
export interface LibraryTakeSource {
	videoId: string;
	label: string;
	url: string;
	durationSeconds: number;
}

/** Plugin state that rides along with one editor state; every hook is optional. */
export interface StateExtension<E = unknown> {
	/** The project as saved, with plugin state embedded (tka: each valid take timing). */
	embed?(project: PostProject): PostProject;
	/** True when a saved take needs nothing more on open or undo (tka: its timing for this take key is loaded). */
	takeReady?(take: PostTake, source: PostProject): boolean;
	/** Media was attached to a take (open, undo, add, relink, adopt). tka: open the take's timing. */
	takeAttached?(take: PostTake, source: PostProject): void;
	/** A saved take whose media is not here: a local file, or a library take the library lacks. */
	takeWithoutMedia?(take: PostTake, source: PostProject): void;
	takeRemoved?(takeId: string): void;
	/** Rewrites an incoming project before it is parsed (tka: timings and sequenceId moved to this sequence, the draft transfer). */
	prepareImport?(incoming: unknown, current: PostProject): unknown;
	/** The parsed import is about to replace the project (tka: keep retained timings). */
	importing?(next: PostProject): void;
	/** A newer save is about to be adopted (tka: merge its timings). */
	adopting?(next: PostProject): void;
	/** Undo or redo crossed an entry that carries an effect. */
	replayEffect?(effect: E, direction: "undo" | "redo"): void;
	/** The alignment the frame evaluator reads; called inside a $derived. */
	alignment?(): FrameAlignment | null;
	/** Extra compile context (tka: animationOverlay); called inside a $derived. */
	compileContext?(): Partial<Omit<CompilePostProjectContext, "now">>;
	/** The selected item changed (tka: clear the tunnel part). */
	selected?(itemId: string | null): void;
	dispose?(): void;
}

export interface VideoEditorStateOptions<E = unknown> {
	/** What the project is about (tka: the sequence id; Ringmaster: the gig id). */
	subjectId: string;
	/** Opens this project instead of the store's (a feature video, a test). */
	initialProject?: PostProject;
	/** A library take's media when a project opens, undoes or adopts. null: not available yet. */
	libraryTake?: (videoId: string) => LibraryTakeSource | null;
	/** Plugin state that rides along with the editor (tka: take timing). Built once, after the state object exists and before saved media loads. */
	extension?: (state: VideoEditorState<E>) => StateExtension<E>;
}

/** A pure project edit; returning the same project means nothing changed. */
export type PostEdit = (project: PostProject, context: EditContext) => PostProject;

export interface VideoEditorState<E = unknown> {
	// Project and saving
	readonly subjectId: string;
	readonly project: PostProject;
	/** The project as saved: the extension's embed, then updatedAt kept at or after the last save. */
	readonly snapshot: PostProject;
	readonly saveError: string | null;
	readonly saveRevision: number;
	saveNow(): void;
	/** Saves the current project; extraError reports a plugin-side save failure (tka: a timing). */
	persist(extraError?: string | null): void;
	// Takes, images and media
	readonly takes: readonly PostTake[];
	takeDisplayLabel(takeId: string): string;
	readonly images: NonNullable<PostProject["images"]>;
	imageUrl(imageId: string): string | null;
	mediaUrl(takeId: string): string | null;
	readonly takesInUse: readonly PostTake[];
	// Compile and frame
	readonly compiled: CompiledPostProject | null;
	readonly durationSeconds: number;
	readonly frameLayers: EvaluatedFrameLayer[];
	/** `frameLayers` plus any a fade leaves fully clear, for the crop screen. */
	readonly presentLayers: EvaluatedFrameLayer[];
	readonly regionRects: Map<string, RegionRect>;
	// Playback
	readonly previewSeconds: number;
	readonly isPlaying: boolean;
	seek(seconds: number): void;
	advance(deltaSeconds: number): void;
	togglePlayback(): void;
	pause(): void;
	// Selection
	/** The setter keeps only an id the project has, and tells the extension on every set. */
	selectedItemId: string | null;
	readonly selectedItem: PostItem | null;
	/** The item a split at the playhead would cut, or null. */
	readonly splitTarget: PostItem | null;
	/** A selection whose layer is not locked. */
	readonly selectionEditable: boolean;
	isLocked(itemId: string): boolean;
	// History
	readonly canUndo: boolean;
	readonly canRedo: boolean;
	readonly inGesture: boolean;
	readonly inSession: boolean;
	/** One undo step to next, carrying effect; false when nothing changed. */
	commit(next: PostProject, effect?: E): boolean;
	/** The project changes without an undo step, then saves (tka: a timing preview look). */
	amend(next: PostProject): void;
	/** The context every edit gets: { now: now(), plugin }. */
	editContext(): EditContext;
	edit(change: PostEdit): boolean;
	editSetting(key: string, change: PostEdit): boolean;
	beginGesture(): void;
	gestureStep(change: PostEdit): void;
	endGesture(): void;
	cancelGesture(): void;
	/** False when a session is already open. */
	beginSession(): boolean;
	endSession(keep: boolean): void;
	undo(): void;
	redo(): void;
	// Edits
	trimLive(itemId: string, edge: "start" | "end", seconds: number): void;
	splitAtPlayhead(): boolean;
	deleteSelected(): boolean;
	duplicateSelected(): boolean;
	addOverlay(spec: NewOverlaySpec): string | null;
	addCard(): string | null;
	setAudio(audio: PostProject["audio"]): void;
	seedAudio(audio: PostProject["audio"]): void;
	// Media
	addLocalVideo(file: File, durationSeconds: number): string | null;
	addLibraryVideo(video: LibraryTakeSource): string | null;
	appendTakeClip(takeId: string): string | null;
	relinkLocalTake(takeId: string, file: File): boolean;
	relinkProjectFiles(files: ReadonlyMap<string, File>): number;
	attachLibraryTakes(): void;
	renameTake(takeId: string, label: string): void;
	removeTake(takeId: string): void;
	// Import and other tabs
	importProject(next: PostProject, files?: ReadonlyMap<string, File>): void;
	adoptSaved(next: PostProject, options?: { evenIfOlder?: boolean }): boolean;
	/** Attaches saved media for a project before it is committed (tka: the dev manifest bridge). */
	loadSavedMedia(source: PostProject): void;
	dispose(): void;
}

interface TakeMedia {
	url: string;
	/** An object URL this state made and must release. */
	owned: boolean;
}

/** How many edits can be undone. */
const HISTORY_DEPTH = 100;
/** Changes to one setting this close together undo as one. */
const SETTING_JOIN_MS = 800;
/** The undo history is kept in the tab once edits pause this long. */
const HISTORY_KEEP_DELAY_MS = 400;
const FRAME_SECONDS = 1 / POST_FRAME_RATE;

export function createVideoEditorState<E = unknown>(
	host: VideoEditorHost<E>,
	plugin: VideoEditorPlugin | undefined,
	options: VideoEditorStateOptions<E>,
): VideoEditorState<E> {
	const now = host.now ?? (() => Date.now());
	const store = host.store ?? createDeviceStore<E>(plugin ? { plugin } : {});
	const translate = translatorFor(host);
	const schema = createProjectSchema(plugin);
	/** Read at every store call, so an owner getter may follow sign-in. */
	const scope = (): StoreScope => ({ ownerId: host.ownerId, subjectId: options.subjectId });
	const editContext = (): EditContext => (plugin ? { now: now(), plugin } : { now: now() });
	const presetIdFor = (current: PostProject): { presetId?: string } => {
		const subject = subjectOf(current, plugin);
		return subject !== undefined ? { presetId: `post-project:${subject}` } : {};
	};

	/** Set once the state object exists; the deriveds below re-run when it is. */
	let extension = $state.raw<StateExtension<E> | undefined>(undefined);

	const initialProject = schema.safeParse(options.initialProject);
	const opened: PostProject =
		initialProject.success && subjectOf(initialProject.data, plugin) === options.subjectId
			? // A project saved with an older layout opens laid out by today's rules.
				normalizeProject(initialProject.data, plugin)
			: store.openProject(scope(), now());
	let project = $state.raw<PostProject>(opened);
	// History keeps its original objects; saved copies must still be newer
	// than the edit that undo, session cancellation, or import replaces.
	let savedUpdatedAt = opened.updatedAt;
	// A reload in this tab brings back the undo history, but only when this is
	// the very save it led up to.
	const restoredHistory = store.loadHistory(scope(), opened);
	let past = $state.raw<PostProject[]>(restoredHistory?.past.map((entry) => entry.project) ?? []);
	let future = $state.raw<PostProject[]>(
		restoredHistory?.future.map((entry) => entry.project) ?? [],
	);
	/** The project a drag started from; each live step re-applies to it. */
	let gestureBase = $state.raw<PostProject | null>(null);
	/** The setting changed last and when, so a slider drag undoes as one step. */
	let lastSetting: { key: string; at: number } | null = null;
	/**
	 * A stretch of editing that lands as one undo step, or none if cancelled:
	 * the crop screen. Undo and Redo stay inside it while it is open.
	 */
	let session = $state.raw<{
		base: PostProject;
		pastAtStart: PostProject[];
		futureAtStart: PostProject[];
		/** Undo steps made inside the session and not undone. */
		steps: number;
		/** Steps undone inside the session that Redo can bring back. */
		undone: number;
	} | null>(null);

	let media = $state.raw<Record<string, TakeMedia>>({});
	let imageMedia = $state.raw<Record<string, TakeMedia>>({});
	let saveError = $state<string | null>(null);
	let saveRevision = $state(0);
	/**
	 * What a plugin changed along with the project, keyed by the project the
	 * edit made, so undoing that edit can put it back too.
	 */
	const effects = new WeakMap<PostProject, E>();
	if (restoredHistory) {
		for (const entry of [...restoredHistory.past, ...restoredHistory.future]) {
			if (entry.effect !== undefined) effects.set(entry.project, entry.effect);
		}
		if (restoredHistory.headEffect !== undefined) effects.set(opened, restoredHistory.headEffect);
	}
	/** The last saved project and the undo lists leading to it, not yet kept. */
	let historyToKeep: {
		/** The project as saved, which is what a reload opens. */
		head: PostProject;
		/** The same project as the editor holds it, which effects key on. */
		headProject: PostProject;
		past: PostProject[];
		future: PostProject[];
	} | null = null;
	let historyTimer: ReturnType<typeof setTimeout> | undefined;

	let previewSeconds = $state(0);
	let playing = $state(false);
	let selectedItemId = $state<string | null>(null);

	const compiled = $derived<CompiledPostProject | null>(
		compilePostProject(
			project,
			{ now: project.updatedAt, ...presetIdFor(project), ...extension?.compileContext?.() },
			plugin,
		),
	);

	/** The timeline's length, hidden tracks included, so nothing sits past it. */
	const durationSeconds = $derived(projectDurationSeconds(project));

	/** Every layer at the playhead, one a fade leaves fully clear included. */
	const presentLayers = $derived.by((): EvaluatedFrameLayer[] => {
		if (!compiled || compiled.durationSeconds <= 0) return [];
		return evaluatePresetLayers(
			compiled.preset,
			compiled.durationSeconds,
			previewSeconds,
			extension?.alignment?.() ?? null,
		);
	});

	const frameLayers = $derived(presentLayers.filter(isVisibleLayer));

	/** Every region's rect at the playhead: static, or where its motion or a
	 *  keyframed box has carried it. The canvas positions its region divs from
	 *  this map, keyed by region id (an item's own id, one region each). */
	const regionRects = $derived.by((): Map<string, RegionRect> => {
		if (!compiled || compiled.durationSeconds <= 0) return new Map();
		return evaluateRegionRects(compiled.preset, compiled.durationSeconds, previewSeconds);
	});

	const selectedItem = $derived(
		selectedItemId ? (findItem(project, selectedItemId)?.item ?? null) : null,
	);

	/** Takes the project's clips use, in timeline order. */
	const takesInUse = $derived.by((): PostTake[] => {
		const used: string[] = [];
		for (const track of project.tracks) {
			for (const item of track.items) {
				if (item.kind === "video" && !used.includes(item.takeId)) {
					used.push(item.takeId);
				}
			}
		}
		return used
			.map((id) => project.takes.find((take) => take.id === id))
			.filter((take): take is PostTake => Boolean(take));
	});

	// ---- The project and its history ---------------------------------------

	function keepSelectionValid(next: PostProject): void {
		if (selectedItemId && !findItem(next, selectedItemId)) selectedItemId = null;
		if (previewSeconds > projectDurationSeconds(next)) {
			previewSeconds = projectDurationSeconds(next);
		}
	}

	/** A new undo step inside an open session; it also ends any redo. */
	function countSessionStep(): void {
		if (session) session = { ...session, steps: session.steps + 1, undone: 0 };
	}

	function snapshotFor(current: PostProject): PostProject {
		const embedded = extension?.embed?.(current) ?? current;
		return {
			...embedded,
			updatedAt: Math.max(current.updatedAt, savedUpdatedAt),
		};
	}

	function persist(extraError?: string | null): void {
		savedUpdatedAt = Math.max(now(), project.updatedAt, savedUpdatedAt + 1);
		const snapshot = snapshotFor(project);
		const result = store.saveProject(scope(), snapshot);
		saveRevision += 1;
		saveError = !result.ok
			? translate("editor_save_failed", { error: result.error })
			: (extraError ?? null);
		// A project that failed to save opens as the older save after a reload,
		// and the history already kept still leads to that one.
		if (result.ok) keepHistorySoon(snapshot);
	}

	/**
	 * The history is written once edits pause, so a slider drag does not copy
	 * the whole history on every frame. A reload or leaving the editor writes
	 * it straight away.
	 */
	function keepHistorySoon(head: PostProject): void {
		historyToKeep = { head, headProject: project, past, future };
		clearTimeout(historyTimer);
		historyTimer = setTimeout(keepHistory, HISTORY_KEEP_DELAY_MS);
	}

	function keepHistory(): void {
		clearTimeout(historyTimer);
		historyTimer = undefined;
		const pending = historyToKeep;
		if (!pending) return;
		historyToKeep = null;
		// Effects are read now, when the history is written, not when the write
		// was scheduled. commit(next, effect) records a plugin's effect before it
		// persists, so every step in these lists already has the one it carries.
		const entry = (step: PostProject): HistoryEntry<E> => {
			const effect = effects.get(step);
			return effect !== undefined ? { project: step, effect } : { project: step };
		};
		const headEffect = effects.get(pending.headProject);
		store.saveHistory(scope(), {
			head: pending.head,
			...(headEffect !== undefined ? { headEffect } : {}),
			past: pending.past.map(entry),
			future: pending.future.map(entry),
		});
	}

	if (typeof window !== "undefined") window.addEventListener("pagehide", keepHistory);

	function commit(next: PostProject, effect?: E): boolean {
		if (next === project) return false;
		past = [...past, project].slice(-HISTORY_DEPTH);
		future = [];
		countSessionStep();
		project = next;
		lastSetting = null;
		keepSelectionValid(next);
		if (effect !== undefined) effects.set(next, effect);
		persist();
		return true;
	}

	function amend(next: PostProject): void {
		project = next;
		persist();
	}

	/** Applies one edit as one undo step; false when it changed nothing. */
	function edit(change: PostEdit): boolean {
		if (gestureBase) return false;
		return commit(change(project, editContext()));
	}

	/**
	 * An edit from a setting that changes many times a second while dragged.
	 * Changes to the same setting in quick succession join one undo step.
	 */
	function editSetting(key: string, change: PostEdit): boolean {
		if (gestureBase) return false;
		const at = now();
		const next = change(project, editContext());
		if (next === project) return false;
		const joins =
			lastSetting !== null &&
			lastSetting.key === key &&
			at - lastSetting.at < SETTING_JOIN_MS &&
			past.length > 0;
		if (joins) {
			future = [];
			if (session) session = { ...session, undone: 0 };
			project = next;
			keepSelectionValid(next);
			persist();
		} else {
			commit(next);
		}
		lastSetting = { key, at };
		return true;
	}

	/**
	 * A drag is one undo step however many frames it takes. Each live step
	 * re-applies its edit to the project the drag started from, so a trim
	 * dragged out and back lands exactly where it began.
	 */
	function beginGesture(): void {
		gestureBase ??= project;
	}

	function gestureStep(change: PostEdit): void {
		if (!gestureBase) return;
		const next = change(gestureBase, editContext());
		project = next;
		keepSelectionValid(next);
	}

	function endGesture(): void {
		const base = gestureBase;
		gestureBase = null;
		lastSetting = null;
		if (!base || project === base) return;
		past = [...past, base].slice(-HISTORY_DEPTH);
		future = [];
		countSessionStep();
		persist();
	}

	function cancelGesture(): void {
		const base = gestureBase;
		gestureBase = null;
		lastSetting = null;
		if (!base) return;
		project = base;
		keepSelectionValid(base);
	}

	/** Replays the effect recorded on `edited`, if it carries one. */
	function replayEffect(edited: PostProject, direction: "undo" | "redo"): void {
		const effect = effects.get(edited);
		if (effect !== undefined) extension?.replayEffect?.(effect, direction);
	}

	function undo(): void {
		if (gestureBase) {
			cancelGesture();
			return;
		}
		if (session && session.steps === 0) return;
		lastSetting = null;
		const previous = past[past.length - 1];
		if (!previous) return;
		const undone = project;
		past = past.slice(0, -1);
		future = [...future, project];
		if (session) {
			session = {
				...session,
				steps: session.steps - 1,
				undone: session.undone + 1,
			};
		}
		project = previous;
		keepSelectionValid(previous);
		loadSavedMedia();
		replayEffect(undone, "undo");
		persist();
	}

	function redo(): void {
		if (gestureBase) {
			cancelGesture();
			return;
		}
		if (session && session.undone === 0) return;
		lastSetting = null;
		const next = future[future.length - 1];
		if (!next) return;
		future = future.slice(0, -1);
		past = [...past, project];
		if (session) {
			session = {
				...session,
				steps: session.steps + 1,
				undone: session.undone - 1,
			};
		}
		project = next;
		keepSelectionValid(next);
		loadSavedMedia();
		replayEffect(next, "redo");
		persist();
	}

	/**
	 * Opens a session: what follows lands as one undo step when it ends kept,
	 * and a slider change cannot join an edit made before it. False when one
	 * is already open.
	 */
	function beginSession(): boolean {
		if (session) return false;
		if (gestureBase) endGesture();
		session = {
			base: project,
			pastAtStart: past,
			futureAtStart: future,
			steps: 0,
			undone: 0,
		};
		lastSetting = null;
		return true;
	}

	/**
	 * Closes the session. Kept, its changes become one undo step, or none when
	 * they came back to where it began; not kept, the project and both undo
	 * lists return to how they were when it opened. A drag still running ends
	 * with it, kept or dropped the same way.
	 */
	function endSession(keep: boolean): void {
		const open = session;
		if (!open) return;
		if (gestureBase) {
			if (keep) endGesture();
			else cancelGesture();
		}
		session = null;
		lastSetting = null;
		if (keep && differs(open.base, project)) {
			past = [...open.pastAtStart, open.base].slice(-HISTORY_DEPTH);
			future = [];
			persist();
			return;
		}
		project = open.base;
		past = open.pastAtStart;
		future = open.futureAtStart;
		keepSelectionValid(open.base);
		persist();
	}

	/** Whether two projects differ in more than when they were saved. */
	function differs(a: PostProject, b: PostProject): boolean {
		if (a === b) return false;
		return JSON.stringify({ ...a, updatedAt: 0 }) !== JSON.stringify({ ...b, updatedAt: 0 });
	}

	/**
	 * Opens the project with a setting from elsewhere, such as the sound picked
	 * in a link, without adding an undo step.
	 */
	function seedAudio(audio: PostProject["audio"]): void {
		if (gestureBase) return;
		const next = setProjectAudio(project, audio, editContext());
		if (next === project) return;
		project = next;
		persist();
	}

	/**
	 * Saves the project now, as the Save button asks. Edits already save
	 * themselves; this stamps the time so this copy is the newest wherever
	 * it is saved, and it adds no undo step.
	 */
	function saveNow(): void {
		if (gestureBase) return;
		const next = {
			...project,
			updatedAt: Math.max(now(), project.updatedAt + 1, savedUpdatedAt + 1),
		};
		const effect = effects.get(project);
		if (effect !== undefined) effects.set(next, effect);
		project = next;
		persist();
	}

	// ---- Takes and their media -----------------------------------------------

	function attach(
		take: PostTake,
		url: string,
		owned: boolean,
		source: PostProject = project,
	): void {
		const previous = media[take.id];
		if (previous?.owned && previous.url !== url) URL.revokeObjectURL(previous.url);
		media = { ...media, [take.id]: { url, owned } };
		extension?.takeAttached?.(take, source);
	}

	function nextTakeId(): string {
		let index = project.takes.length + 1;
		while (project.takes.some((take) => take.id === `take-${index}`)) index += 1;
		return `take-${index}`;
	}

	/**
	 * Media saved in the project: library and linked takes and linked images
	 * come straight back, a local file waits to be picked again. Undo after a
	 * reload can bring back media this page has not loaded yet, so it runs
	 * then too. `source` is the project about to open, when that is not the
	 * current one yet.
	 */
	function loadSavedMedia(source: PostProject = project): void {
		for (const take of source.takes) {
			if (extension?.takeReady?.(take, source)) continue;
			if (take.ref.kind === "catalog") {
				const video = options.libraryTake?.(take.ref.videoId) ?? null;
				if (video) attach(take, video.url, false, source);
				else extension?.takeWithoutMedia?.(take, source);
			} else if (take.ref.kind === "linked") {
				attach(take, take.ref.url, false, source);
			} else {
				extension?.takeWithoutMedia?.(take, source);
			}
		}
		for (const image of source.images ?? []) {
			if (image.ref.kind === "linked" && !imageMedia[image.id]) {
				imageMedia = {
					...imageMedia,
					[image.id]: { url: image.ref.url, owned: false },
				};
			}
		}
	}

	/** The incoming project moved to this editor's subject, as an import is. */
	function withSubject(incoming: unknown): unknown {
		return incoming && typeof incoming === "object"
			? { ...incoming, [subjectKeyOf(plugin)]: options.subjectId }
			: incoming;
	}

	/** Import through the same atomic history path as every other edit. */
	function importProject(next: PostProject, files: ReadonlyMap<string, File> = new Map()): void {
		if (gestureBase || session) throw new Error(translate("editor_import_busy"));
		const incoming = extension?.prepareImport?.(next, project) ?? next;
		const parsed = schema.parse(withSubject(incoming));
		for (const asset of [...parsed.takes, ...(parsed.images ?? [])]) {
			if (asset.ref.kind === "local" && !files.has(asset.ref.name)) {
				throw new Error(translate("editor_missing_media", { name: asset.ref.name }));
			}
		}
		// Preserve the old project before changing the project or its loaded media.
		store.backupBeforeImport(scope(), snapshotFor(project));
		extension?.importing?.(parsed);
		for (const take of parsed.takes) {
			if (take.ref.kind === "linked") attach(take, take.ref.url, false, parsed);
			else if (take.ref.kind === "local") {
				const file = files.get(take.ref.name);
				if (!file) throw new Error(translate("editor_missing_video", { name: take.ref.name }));
				attach(take, URL.createObjectURL(file), true, parsed);
			} else extension?.takeWithoutMedia?.(take, parsed);
		}
		const nextImages = { ...imageMedia };
		for (const image of parsed.images ?? []) {
			if (image.ref.kind === "linked") nextImages[image.id] = { url: image.ref.url, owned: false };
			else if (image.ref.kind === "local") {
				const file = files.get(image.ref.name);
				if (!file) throw new Error(translate("editor_missing_image", { name: image.ref.name }));
				nextImages[image.id] = { url: URL.createObjectURL(file), owned: true };
			}
		}
		playing = false;
		imageMedia = nextImages;
		commit(parsed);
		previewSeconds = 0;
		selectedItemId = null;
	}

	/**
	 * Takes a newer save of this project from another open tab, so tabs on one
	 * project never drift apart. It joins the undo history like an edit but is
	 * not saved again: the other tab already saved it. A copy that needs a
	 * video only the other tab holds (a file picked there) is left alone.
	 *
	 * A feature video passes `evenIfOlder`: its copy on disk wins even when
	 * this editor's edits are later, and Undo brings those edits back.
	 */
	function adoptSaved(next: PostProject, adopt: { evenIfOlder?: boolean } = {}): boolean {
		if (gestureBase || session) return false;
		const parsed = schema.safeParse(next);
		if (
			!parsed.success ||
			subjectOf(parsed.data, plugin) !== subjectOf(project, plugin) ||
			// This tab's own saves carry savedUpdatedAt, so only a later save from
			// somewhere else gets through.
			(!adopt.evenIfOlder && parsed.data.updatedAt <= Math.max(project.updatedAt, savedUpdatedAt))
		)
			return false;
		const incoming = parsed.data;
		const known = new Map(project.takes.map((take) => [take.id, JSON.stringify(take.ref)]));
		const added = incoming.takes.filter((take) => known.get(take.id) !== JSON.stringify(take.ref));
		if (added.some((take) => take.ref.kind === "local")) return false;
		extension?.adopting?.(incoming);
		for (const take of added) {
			if (take.ref.kind === "linked") attach(take, take.ref.url, false, incoming);
			else extension?.takeWithoutMedia?.(take, incoming);
		}
		const nextImages = { ...imageMedia };
		for (const image of incoming.images ?? [])
			if (image.ref.kind === "linked" && !nextImages[image.id])
				nextImages[image.id] = { url: image.ref.url, owned: false };
		imageMedia = nextImages;
		past = [...past, project].slice(-HISTORY_DEPTH);
		future = [];
		project = incoming;
		savedUpdatedAt = Math.max(savedUpdatedAt, incoming.updatedAt);
		lastSetting = null;
		keepSelectionValid(incoming);
		// The other tab's save is what a reload opens; the history now leads to it.
		keepHistorySoon(incoming);
		return true;
	}

	/** The library loads after the editor opens; saved takes get their video. */
	function attachLibraryTakes(): void {
		for (const take of project.takes) {
			if (take.ref.kind !== "catalog" || media[take.id]) continue;
			const video = options.libraryTake?.(take.ref.videoId) ?? null;
			if (video) attach(take, video.url, false);
		}
	}

	/**
	 * Adds a video to the end of the main track, InShot style: the take joins
	 * the project (once per file) and a clip of all of it lands on the
	 * timeline, selected, with the playhead on its first frame.
	 */
	function placeTake(take: PostTake): string | null {
		if (gestureBase) return null;
		const ctx = editContext();
		const withTake = addTake(project, take, ctx);
		const stored = withTake.takes.find((entry) => entry.takeKey === take.takeKey);
		const placed = stored ? appendVideoClip(withTake, stored.id, ctx) : null;
		if (!placed) {
			commit(withTake);
			return null;
		}
		commit(placed.project);
		selectItemAtStart(placed.itemId);
		return placed.itemId;
	}

	/** Puts another whole clip of a take on the end of the main track. */
	function appendTakeClip(takeId: string): string | null {
		const take = project.takes.find((entry) => entry.id === takeId);
		return take ? placeTake(take) : null;
	}

	function selectItemAtStart(itemId: string): void {
		const item = findItem(project, itemId)?.item;
		if (!item) return;
		selectedItemId = itemId;
		previewSeconds = item.start;
	}

	function takeForKey(takeKey: string): PostTake | undefined {
		return project.takes.find((take) => take.takeKey === takeKey);
	}

	function addLocalVideo(file: File, durationSeconds: number): string | null {
		const takeKey = localTakeKey(file);
		const take: PostTake = takeForKey(takeKey) ?? {
			id: nextTakeId(),
			label:
				file.name
					.replace(/[.][^.]+$/, "")
					.trim()
					.slice(0, 120) || translate("editor_default_take"),
			ref: {
				kind: "local",
				name: file.name,
				size: file.size,
				lastModified: file.lastModified,
			},
			takeKey,
			durationSeconds,
		};
		attach(take, URL.createObjectURL(file), true);
		return placeTake(take);
	}

	function addLibraryVideo(video: LibraryTakeSource): string | null {
		const takeKey = libraryTakeKey(video.videoId);
		const take: PostTake = takeForKey(takeKey) ?? {
			id: nextTakeId(),
			label: video.label.trim().slice(0, 120) || translate("editor_default_take"),
			ref: { kind: "catalog", videoId: video.videoId },
			takeKey,
			durationSeconds: video.durationSeconds,
		};
		attach(take, video.url, false);
		return placeTake(take);
	}

	/** Reattaches a saved local take; false when the file is a different one. */
	function relinkLocalTake(takeId: string, file: File): boolean {
		const take = project.takes.find((candidate) => candidate.id === takeId);
		if (
			!take ||
			take.ref.kind !== "local" ||
			take.ref.name !== file.name ||
			take.ref.size !== file.size ||
			take.ref.lastModified !== file.lastModified
		)
			return false;
		attach(take, URL.createObjectURL(file), true);
		return true;
	}

	/** Restore selected source files after reload without replacing the user's edits. */
	function relinkProjectFiles(files: ReadonlyMap<string, File>): number {
		const matches = (ref: PostTake["ref"]): File | undefined => {
			if (ref.kind !== "local") return undefined;
			const file = files.get(ref.name);
			return file && file.size === ref.size && file.lastModified === ref.lastModified
				? file
				: undefined;
		};
		let linked = 0;
		for (const take of project.takes) {
			const file = matches(take.ref);
			if (file) {
				attach(take, URL.createObjectURL(file), true);
				linked++;
			}
		}
		const nextImages = { ...imageMedia };
		for (const asset of project.images ?? []) {
			const file = matches(asset.ref);
			if (!file) continue;
			const previous = nextImages[asset.id];
			if (previous?.owned) URL.revokeObjectURL(previous.url);
			nextImages[asset.id] = { url: URL.createObjectURL(file), owned: true };
			linked++;
		}
		imageMedia = nextImages;
		return linked;
	}

	function renameTake(takeId: string, label: string): void {
		const name = cleanLabel(label);
		if (!name) return;
		edit((current, ctx) => {
			const take = current.takes.find((entry) => entry.id === takeId);
			if (!take) return current;
			const previousName = takeDisplayLabel(current, takeId);
			const tracks = current.tracks.map((track) => ({
				...track,
				items: track.items.map((item) =>
					item.kind === "video" && item.takeId === takeId && item.label === previousName
						? { ...item, label: name }
						: item,
				),
			}));
			if (take.label === name && previousName === name) return current;
			return {
				...current,
				takes: current.takes.map((entry) =>
					entry.id === takeId ? { ...entry, label: name } : entry,
				),
				tracks,
				updatedAt: ctx.now,
			};
		});
	}

	/** Removes a take and every clip cut from it. */
	function removeTake(takeId: string): void {
		const changed = edit((current, ctx) => removeProjectTake(current, takeId, ctx));
		if (!changed) return;
		// Undo can bring the take back, so its media stays loaded until the
		// editor closes.
		extension?.takeRemoved?.(takeId);
	}

	// ---- Edits the toolbar and keys make -------------------------------------

	/** A locked layer's items cannot be moved, trimmed, split or removed. */
	function isLocked(itemId: string): boolean {
		const located = findItem(project, itemId);
		return located ? project.tracks[located.trackIndex]!.locked : false;
	}

	/**
	 * What a split at this time cuts: the selection when the playhead is
	 * inside it, else the main clip there. Both pieces must stay long enough
	 * to grab.
	 */
	function splitTargetAt(seconds: number): PostItem | null {
		const inside = (item: PostItem) =>
			seconds - item.start > POST_MIN_ITEM_SECONDS + POST_TIME_EPSILON &&
			itemEnd(item) - seconds > POST_MIN_ITEM_SECONDS + POST_TIME_EPSILON;
		for (const item of [selectedItem, mainItemAt(project, seconds)]) {
			if (item && inside(item) && !isLocked(item.id)) return item;
		}
		return null;
	}

	const splitTarget = $derived(splitTargetAt(previewSeconds));
	const selectionEditable = $derived(selectedItem !== null && !isLocked(selectedItem.id));

	/** Splits at the playhead and selects the second piece. */
	function splitAtPlayhead(): boolean {
		const target = splitTarget;
		if (!target || gestureBase) return false;
		const result = splitItemAt(project, target.id, previewSeconds, editContext());
		if (!result || !commit(result.project)) return false;
		selectedItemId = result.newItemId;
		return true;
	}

	function deleteSelected(): boolean {
		const target = selectedItem;
		if (!target || isLocked(target.id)) return false;
		return edit((current, ctx) => deleteItem(current, target.id, ctx));
	}

	function duplicateSelected(): boolean {
		const target = selectedItem;
		if (!target || gestureBase || isLocked(target.id)) return false;
		const result = duplicateItem(project, target.id, editContext());
		if (!result || !commit(result.project)) return false;
		selectedItemId = result.newItemId;
		return true;
	}

	function addOverlay(spec: NewOverlaySpec): string | null {
		if (gestureBase) return null;
		const result = addOverlayItem(project, spec, editContext());
		if (!result || !commit(result.project)) return null;
		selectedItemId = result.itemId;
		return result.itemId;
	}

	/** The card goes on the end of the main track. */
	function addCard(): string | null {
		if (gestureBase) return null;
		const result = appendCardClip(project, editContext());
		if (!commit(result.project)) return null;
		selectItemAtStart(result.itemId);
		return result.itemId;
	}

	/**
	 * A trim shows the frame at the edge being dragged, as InShot does: the
	 * new first frame, or the last one.
	 */
	function trimLive(itemId: string, edge: "start" | "end", seconds: number): void {
		if (isLocked(itemId)) return;
		gestureStep((base, ctx) => trimItem(base, itemId, edge, seconds, ctx));
		const trimmed = findItem(project, itemId)?.item;
		if (!trimmed) return;
		previewSeconds =
			edge === "start" ? trimmed.start : Math.max(trimmed.start, itemEnd(trimmed) - FRAME_SECONDS);
	}

	function setAudio(audio: PostProject["audio"]): void {
		edit((current, ctx) => setProjectAudio(current, audio, ctx));
	}

	// ---- The preview clock ---------------------------------------------------

	function seek(seconds: number): void {
		previewSeconds = Math.min(durationSeconds, Math.max(0, seconds));
	}

	function advance(deltaSeconds: number): void {
		if (!playing) return;
		const next = previewSeconds + deltaSeconds;
		if (next >= durationSeconds) {
			previewSeconds = durationSeconds;
			playing = false;
			return;
		}
		previewSeconds = next;
	}

	function togglePlayback(): void {
		if (!playing && previewSeconds >= durationSeconds - 1e-3) previewSeconds = 0;
		playing = durationSeconds > 0 && !playing;
	}

	function pause(): void {
		playing = false;
	}

	function dispose(): void {
		keepHistory();
		if (typeof window !== "undefined") window.removeEventListener("pagehide", keepHistory);
		for (const held of Object.values(media)) {
			if (held.owned) URL.revokeObjectURL(held.url);
		}
		for (const held of Object.values(imageMedia)) {
			if (held.owned) URL.revokeObjectURL(held.url);
		}
		extension?.dispose?.();
	}

	const state: VideoEditorState<E> = {
		get subjectId() {
			return options.subjectId;
		},
		get project() {
			return project;
		},
		get snapshot() {
			return snapshotFor(project);
		},
		get saveError() {
			return saveError;
		},
		get saveRevision() {
			return saveRevision;
		},
		saveNow,
		persist,
		get takes() {
			return project.takes;
		},
		takeDisplayLabel(takeId: string): string {
			return takeDisplayLabel(project, takeId);
		},
		get images() {
			return project.images ?? [];
		},
		imageUrl(imageId: string): string | null {
			return imageMedia[imageId]?.url ?? null;
		},
		mediaUrl(takeId: string): string | null {
			return media[takeId]?.url ?? null;
		},
		get takesInUse() {
			return takesInUse;
		},
		get compiled() {
			return compiled;
		},
		get durationSeconds() {
			return durationSeconds;
		},
		get frameLayers() {
			return frameLayers;
		},
		get presentLayers() {
			return presentLayers;
		},
		get regionRects() {
			return regionRects;
		},
		get previewSeconds() {
			return previewSeconds;
		},
		get isPlaying() {
			return playing;
		},
		seek,
		advance,
		togglePlayback,
		pause,
		get selectedItemId() {
			return selectedItemId;
		},
		set selectedItemId(next: string | null) {
			selectedItemId = next && findItem(project, next) ? next : null;
			extension?.selected?.(selectedItemId);
		},
		get selectedItem() {
			return selectedItem;
		},
		get splitTarget() {
			return splitTarget;
		},
		get selectionEditable() {
			return selectionEditable;
		},
		isLocked,
		get canUndo() {
			return gestureBase !== null || (past.length > 0 && (!session || session.steps > 0));
		},
		get canRedo() {
			return gestureBase !== null || (future.length > 0 && (!session || session.undone > 0));
		},
		get inGesture() {
			return gestureBase !== null;
		},
		get inSession() {
			return session !== null;
		},
		commit,
		amend,
		editContext,
		edit,
		editSetting,
		beginGesture,
		gestureStep,
		endGesture,
		cancelGesture,
		beginSession,
		endSession,
		undo,
		redo,
		trimLive,
		splitAtPlayhead,
		deleteSelected,
		duplicateSelected,
		addOverlay,
		addCard,
		setAudio,
		seedAudio,
		addLocalVideo,
		addLibraryVideo,
		appendTakeClip,
		relinkLocalTake,
		relinkProjectFiles,
		attachLibraryTakes,
		renameTake,
		removeTake,
		importProject,
		adoptSaved,
		loadSavedMedia,
		dispose,
	};

	extension = options.extension?.(state);
	loadSavedMedia();
	return state;
}
