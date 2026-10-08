import type { CompiledPostProject } from "../core/compile/compiler.js";
import type { PostProject } from "../core/project/item-kinds.js";
import type { PostStudioLayerPainter } from "./layer-painter.js";
import { createTextItemPainter } from "./text-item-painter.js";

/** What a painter factory reads to decide whether a role is its own and to build its painter. */
export interface PainterEnv {
	project: PostProject;
	compiled: CompiledPostProject;
}

export interface PainterFactory {
	id: string;
	/** Creates the painter for a preset source role, or null when the role is not this factory's. */
	create(role: string, env: PainterEnv): PostStudioLayerPainter | null;
}

export interface PainterRegistry {
	/** One painter per source role the compiled preset's clips use, keyed by that role. */
	paintersFor(env: PainterEnv): Map<string, PostStudioLayerPainter>;
}

/**
 * Factories are asked in order; the first non-null painter for a role wins.
 * Callers list the core factories first, then the plugin's.
 */
export function createPainterRegistry(factories: readonly PainterFactory[]): PainterRegistry {
	return {
		paintersFor(env) {
			const painters = new Map<string, PostStudioLayerPainter>();
			for (const clip of env.compiled.preset.clips) {
				const role = clip.sourceRole;
				if (painters.has(role)) continue;
				for (const factory of factories) {
					const painter = factory.create(role, env);
					if (painter) {
						painters.set(role, painter);
						break;
					}
				}
			}
			return painters;
		},
	};
}

/** The core text painter factory: a role one of the compiled text items draws into. */
export const textPainterFactory: PainterFactory = {
	id: "text",
	create(role, env) {
		const entry = env.compiled.texts.find((text) => text.role === role);
		if (!entry) return null;
		return createTextItemPainter(
			() => env.compiled.texts.find((text) => text.itemId === entry.itemId) ?? null,
		);
	},
};
