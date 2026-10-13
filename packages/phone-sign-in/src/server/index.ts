// @austencloud/phone-sign-in/server: the routes and what they are built from.
// An app supplies its Firestore store, service account signer, ID token check
// and rate limiter, and wraps each handler in a one-line route.
export {
	createPhoneSignInServer,
	clientAddress,
	killSwitchOn,
	verifiedUserFromClaims,
	DISABLED_MESSAGE,
	MAX_TOKEN_AGE_SECONDS,
	NO_STORE,
	type PhoneSignInHandlers,
	type PhoneSignInParts,
	type PhoneSignInServerConfig,
	type RouteContext,
	type RouteHandler,
	type SignInNotice,
	type VerifiedUser
} from './handlers';
export type { PhoneSignInStore, StoredDocument } from './store';
export {
	createCustomTokenMinter,
	createServiceAccountSigner,
	CUSTOM_TOKEN_LIFETIME_SECONDS,
	IDENTITY_TOOLKIT_AUDIENCE,
	type MintCustomToken,
	type ServiceAccount,
	type SignJwt
} from './custom-token';
export { ACCOUNTS_UPDATE_SCOPE, createSessionRevoker, type RevokeSessions } from './revoke-sessions';
export { createServerKeys, constantTimeEqual, type KeyPurpose, type ServerKeys } from './server-key';
export {
	createRequestLifecycle,
	isRequestId,
	sameNetwork,
	PURGE_AFTER_MS,
	REQUEST_LIFETIME_MS,
	REQUESTS_COLLECTION,
	type RequestLifecycle
} from './requests';
export { createTrustedPhones, parsePublicKey, TRUSTED_PHONES_COLLECTION, type TrustedPhones } from './trusted-phones';
export { approveUrl } from './approve-link';
export { forgetPublicAddress } from './public-address';
