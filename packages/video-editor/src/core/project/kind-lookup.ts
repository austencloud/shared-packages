import type { ItemKindDefinition, VideoEditorPlugin } from "../../plugin.js";
import type { PostItem } from "./item-kinds.js";

/**
 * The plugin's definition of an item kind: undefined with no plugin or when
 * the plugin defines no such kind.
 */
export function kindDefinition(
	plugin: VideoEditorPlugin | null | undefined,
	kind: string,
): ItemKindDefinition | undefined {
	return plugin?.itemKinds.find((entry) => entry.kind === kind);
}

/** Whether items of the kind may sit on the main track: a core clip, image or card, or a plugin kind that says so. */
export function isMainTrackKind(plugin: VideoEditorPlugin | null | undefined, kind: string): boolean {
	// The core list is MAIN_TRACK_KINDS in schema.ts, which imports this file.
	if (kind === "video" || kind === "image" || kind === "card") return true;
	return kindDefinition(plugin, kind)?.mainTrack === true;
}

/** The span fields an item of a sourced plugin kind carries, as a clip does. */
export interface SourcedSpan {
	sourceIn: number;
	sourceOut: number;
	speed: number;
}

/**
 * The length of the source a plugin kind's item plays (see `ItemKindDefinition.sourceLength`), or
 * null when the item's kind plays no source of its own. A core clip answers null; its take says.
 */
export function pluginSourceLength(
	plugin: VideoEditorPlugin | null | undefined,
	item: PostItem,
): number | null {
	const length = kindDefinition(plugin, item.kind)?.sourceLength;
	return length ? length(item) : null;
}
