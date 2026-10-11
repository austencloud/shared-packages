// @austencloud/phone-sign-in: the parts the browser and the server share.
// Server code is in '@austencloud/phone-sign-in/server', the browser's calls
// in '/client', and the QR code component in '/svelte'.

export type {
	ApprovalRequest,
	ApprovalStatus,
	AutoAnswer,
	CollectAnswer,
	DecisionResult,
	NotMeAnswer,
	PublicKeyJwk,
	StartedRequest
} from './types';
export { autoApprovalMessage } from './shared/auto-message';
export { formatCode } from './shared/format-code';
export { describeDevice, describePlace, describeSite } from './shared/describe-device';
export {
	CONFIRM_GRACE_MS,
	newGate,
	needsConfirmation,
	serverAskedToConfirm,
	serverFoundOtherNetwork,
	tapApprove,
	tapDeny,
	type GateContext,
	type GateState,
	type Tap
} from './shared/approve-gate';
export { ageLabel, askedAgoMs, hasExpired, type ServerMeasured } from './shared/request-clock';
export {
	afterAutoAnswer,
	autoApprovedText,
	notMeNotice,
	shouldTryAuto,
	type AfterAuto,
	type AutoContext,
	type NotMeNotice
} from './shared/auto-approve';
export { isApprovePagePath, loginPathFor, safeNext, type PagePaths } from './shared/login-next';
