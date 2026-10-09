import { z } from "zod";
import { PREVIEW_VIDEO_POLICY } from "./preview-video.js";

/**
 * What `scripts/make-edit-copies.ts` writes beside a recording as
 * `<name>.edit.json`, describing `<name>.edit.mp4`.
 */
export const EditCopyManifestSchema = z.object({
	policy: z.literal(PREVIEW_VIDEO_POLICY),
	source: z.object({
		bytes: z.number().int().positive(),
		width: z.number().int().positive(),
		height: z.number().int().positive(),
		durationSeconds: z.number().positive(),
	}),
	copy: z.object({
		width: z.number().int().positive(),
		height: z.number().int().positive(),
		durationSeconds: z.number().positive(),
	}),
});
export type EditCopyManifest = z.infer<typeof EditCopyManifestSchema>;
