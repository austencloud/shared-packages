/**
 * Stops a media element and drops its download. A removed element keeps playing, and keeps its
 * download open until its source goes, so a remounted editor would wait behind it.
 */
export function releaseMediaDownload(element: HTMLMediaElement): void {
	element.pause();
	element.removeAttribute("src");
	element.load();
}
