// @austencloud/phone-sign-in/client: the browser calls and this phone's key.
export {
	createPhoneSignInClient,
	type ApiFetch,
	type PhoneSignInClient,
	type PhoneSignInClientOptions
} from './phone-sign-in';
export {
	createTrustedPhoneKey,
	indexedDbKeyStore,
	trustedPhoneSupported,
	type KeyStore,
	type StoredKey,
	type TrustedPhoneKey,
	type TrustedPhoneKeyOptions
} from './trusted-phone-key';
export {
	createNotificationApprover,
	opensApprovePage,
	type NotificationApprover,
	type NotificationApproverOptions,
	type NotificationOutcome
} from './notification-approval';
