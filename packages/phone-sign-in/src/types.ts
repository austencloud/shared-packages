// What the browser and the server say to each other. Both sides import these,
// so a route and the page that calls it can never drift apart.

export interface StartedRequest {
	id: string;
	code: string;
	secret: string;
	expiresAt: string;
	/**
	 * How long the code lasts, by the server's clock, at the moment it answered.
	 * Count down from this when the answer arrives; this computer's clock may not
	 * agree with `expiresAt`.
	 */
	expiresInMs: number;
	approveUrl: string;
}

export type CollectAnswer =
	| { status: 'pending' }
	| { status: 'denied' }
	| { status: 'expired' }
	| { status: 'approved'; token: string };

export type ApprovalStatus = 'pending' | 'approved' | 'denied' | 'used' | 'expired';

export interface ApprovalRequest {
	status: ApprovalStatus;
	code: string;
	/** `site` names the copy of the app that asked ("a local copy (127.0.0.1:5231)"); '' for the live site. */
	device: { label: string; place: string; site: string };
	/** False when the request came from another internet connection than this phone. */
	sameNetwork: boolean;
	createdAt: string;
	expiresAt: string;
	/** How long ago the request was made, by the server's clock, when it answered. */
	ageMs: number;
	/** How long until it expires, by the server's clock, when it answered. */
	expiresInMs: number;
}

/** What the server did with a decision. 'confirm-network' means nothing was saved yet. */
export type DecisionResult = 'approved' | 'denied' | 'expired' | 'already-decided' | 'confirm-network';

/** What the server did with an automatic approval. Everything but 'approved' leaves the request as it was. */
export type AutoAnswer = 'approved' | 'expired' | 'already-decided' | 'different-network' | 'not-trusted';

/**
 * What "That wasn't me" managed: every session signing out, automatic approval
 * off, and whether the request was blocked before the computer collected it
 * (so the computer never got in).
 */
export interface NotMeAnswer {
	signedOut: boolean;
	autoOff: boolean;
	blocked: boolean;
}

/** The public half of a trusted phone's P-256 key, as the browser exports it. */
export interface PublicKeyJwk {
	kty: 'EC';
	crv: 'P-256';
	x: string;
	y: string;
}
