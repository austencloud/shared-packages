// Where the QR sends the phone. Every server an app runs writes requests to the
// same Firestore project, so the phone always approves on the live site, where
// it is signed in, and the server that asked collects the approval. A server on
// the Firestore emulator alone keeps its own origin: the live site cannot see it.
// Spec: Ringmaster docs/superpowers/specs/2026-10-09-phone-sign-in-any-server-design.md

export interface ApproveLinkOptions {
	/** The live site's origin, such as 'https://ringmaster.cirqueaflame.com'. */
	liveOrigin: string;
	/** Where approve pages live. Default '/sign-in'. */
	approvePath?: string;
}

export function approveUrl(
	id: string,
	requestOrigin: string,
	emulatorOnly: boolean,
	{ liveOrigin, approvePath = '/sign-in' }: ApproveLinkOptions
): string {
	return `${emulatorOnly ? requestOrigin : liveOrigin}${approvePath}/${id}`;
}
