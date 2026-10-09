import type { VideoEditorPlugin } from "../../plugin.js";
import type { PostProject } from "./item-kinds.js";

export function subjectKeyOf(plugin?: VideoEditorPlugin): string {
	return plugin?.subjectKey ?? "subjectId";
}

export function subjectOf(project: PostProject, plugin?: VideoEditorPlugin): string | undefined {
	const value = (project as unknown as Record<string, unknown>)[subjectKeyOf(plugin)];
	return typeof value === "string" ? value : undefined;
}
