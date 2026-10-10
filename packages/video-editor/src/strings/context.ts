import { getContext, setContext } from "svelte";
import { englishString, type Translate } from "./translate.js";

const STRINGS = Symbol("video-editor-strings");

export function provideStrings(translate: Translate): Translate {
	setContext(STRINGS, translate);
	return translate;
}

/** The translate the nearest <VideoEditor> (or a test) provided, else English. Call during component init. */
export function useStrings(): Translate {
	return getContext<Translate | undefined>(STRINGS) ?? englishString;
}
