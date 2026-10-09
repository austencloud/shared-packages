import type {
	PostCardItemCore,
	PostImageItemCore,
	PostProjectCore,
	PostTextItemCore,
	PostTrackCore,
	PostVideoItemCore,
} from "./schema.js";

/* eslint-disable @typescript-eslint/no-empty-object-type */
/** Fields a plugin adds to the core `video` kind. tka augments this. */
export interface PluginVideoFields {}
/** Fields a plugin adds to the core `image` kind. */
export interface PluginImageFields {}
/** Fields a plugin adds to the core `card` kind. */
export interface PluginCardFields {}
/** Fields a plugin adds to the core `text` kind. */
export interface PluginTextFields {}
/** Item kinds a plugin adds, keyed by their `kind` literal. */
export interface PluginItemKinds {}
/** Top-level project fields a plugin adds. */
export interface PluginProjectFields {}
/** Entries a plugin adds to the compile result, after `texts`. */
export interface PluginCompiledOutputs {}
/** Fields a plugin adds to the Add spec (augment it). */
export interface PluginOverlaySpec {}
/** Fields a plugin adds to an item patch (augment it). */
export interface PluginItemPatch {}
/* eslint-enable @typescript-eslint/no-empty-object-type */

export type PostVideoItem = PostVideoItemCore & PluginVideoFields;
export type PostImageItem = PostImageItemCore & PluginImageFields;
export type PostCardItem = PostCardItemCore & PluginCardFields;
export type PostTextItem = PostTextItemCore & PluginTextFields;

export interface CoreItemKinds {
	video: PostVideoItem;
	image: PostImageItem;
	card: PostCardItem;
	text: PostTextItem;
}
export type PostItemKinds = CoreItemKinds & PluginItemKinds;
export type PostItemKind = keyof PostItemKinds & string;
export type PostItem = PostItemKinds[PostItemKind];
export type CoreItemKind = keyof CoreItemKinds;

export type PostTrack = Omit<PostTrackCore, "items"> & { items: PostItem[] };
export type PostProject = Omit<PostProjectCore, "tracks"> & {
	tracks: PostTrack[];
} & PluginProjectFields;
