import type { ItemKindDefinition, VideoEditorPlugin } from "../../plugin.js";

/**
 * The plugin's definition of an item kind: undefined with no plugin or when
 * the plugin defines no such kind.
 */
export function kindDefinition(
	plugin: VideoEditorPlugin | undefined,
	kind: string,
): ItemKindDefinition | undefined {
	return plugin?.itemKinds.find((entry) => entry.kind === kind);
}
