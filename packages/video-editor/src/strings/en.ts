/**
 * The editor's English text. Only the keys 2A's moved code needs; 2B grows the table.
 *
 * A {placeholder} name is matched by formatString as [a-z_]+, so it stays lowercase letters and
 * underscores with no digits or capitals; {name1} or {fileName} would be left unfilled. Keep the
 * keys in the same lowercase style.
 */
export const EN = {
	editor_default_take: "Take",
	editor_save_failed: "The project could not be saved: {error}",
	editor_import_busy: "Finish the current edit before importing a project.",
	editor_missing_media: "Missing media: {name}",
	editor_missing_video: "Missing video: {name}",
	editor_missing_image: "Missing image: {name}",
} as const;

export type StringKey = keyof typeof EN;
