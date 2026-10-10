/** tka shows an em dash in export_app_locked; the source file stays ASCII. */
const EM_DASH = String.fromCharCode(8212);

/**
 * The editor's English text. Only the keys 2A's moved code needs; 2B grows the table.
 *
 * A {placeholder} name is matched by formatString as [a-z_]+, so it stays lowercase letters and
 * underscores with no digits or capitals; {name1} or {fileName} would be left unfilled. Keep the
 * keys in the same lowercase style.
 */
export const EN = {
	action_cancel: "Cancel",
	action_close: "Close",
	action_retry: "Retry",
	common_cancel: "Cancel",
	common_continue: "Continue",
	common_dont_ask_again: "Don't ask again",
	common_type_value: "Type a value",
	editor_default_take: "Take",
	editor_import_busy: "Finish the current edit before importing a project.",
	editor_missing_image: "Missing image: {name}",
	editor_missing_media: "Missing media: {name}",
	editor_missing_video: "Missing video: {name}",
	editor_save_failed: "The project could not be saved: {error}",
	export_app_locked: "Exporting " + EM_DASH + " the app is locked",
	export_failed: "Export failed",
	export_stay_here: "Please don't navigate away.",
	learn_back: "Back",
	store_save_failed: "The post could not be saved on this device.",
	store_unavailable: "Device storage is unavailable. The current post was kept.",
	store_verify_failed: "The post could not be verified in device storage.",
	viewer_ui_export_progress: "Export progress",
} as const;

export type StringKey = keyof typeof EN;
