# @austencloud/phone-sign-in

Sign a computer in by scanning a QR code with a phone that is already signed
in. Built from Ringmaster's phone sign-in and shared by Ringmaster and the
Flow Arts Composer.

The computer asks for a sign-in and shows a QR code with a six-digit code. The
phone opens the approve page, the owner checks the code and taps Approve, and
the computer collects a 30-second Firebase custom token for the approver's own
account. A phone the owner trusts can approve by itself: it holds a
non-extractable P-256 key and signs the request id. Approvals warn when the
phone is on a different network from the computer, and "That wasn't me" blocks
the request, turns automatic approval off and signs every session out.

## Entry points

| Import                                | What it holds                                                                   |
| ------------------------------------- | ------------------------------------------------------------------------------- |
| `@austencloud/phone-sign-in`          | Types and page logic both sides share: code format, approve gate, clocks, notices |
| `@austencloud/phone-sign-in/server`   | `createPhoneSignInServer`: every route as a function over a standard `Request`   |
| `@austencloud/phone-sign-in/client`   | `createPhoneSignInClient` and `createTrustedPhoneKey` for the browser            |
| `@austencloud/phone-sign-in/svelte`   | `QrCode`                                                                         |
| `@austencloud/phone-sign-in/testing`  | `createMemoryStore`, an in-memory Firestore stand-in                             |

## Server

Each app supplies its own Firestore store, service account signer, ID token
check and rate limiter, and fixes its values once:

```ts
const phoneSignIn = createPhoneSignInServer({
	appName: 'Ringmaster',
	liveOrigin: 'https://ringmaster.cirqueaflame.com',
	salt: 'ringmaster-phone-sign-in',
	autoPurpose: 'ringmaster-phone-sign-in-auto',
	store, // PhoneSignInStore over the app's Firestore client
	serverSecret, // the service account private key, as bytes
	signJwt, // createServiceAccountSigner(...) or the app's own signer
	verifyUser: async (request) => verifiedUserFromClaims(await requireAdmin(request)),
	rateLimit,
	projectId,
	emulator,
	accessToken,
	forgetAccessToken,
	disabled: () => killSwitchOn(env.PHONE_SIGN_IN_DISABLED),
	dev
});
```

Each route file is then one line, for example:

```ts
export const POST: RequestHandler = ({ request, params, platform, url, getClientAddress }) =>
	phoneSignIn.decision(request, { id: params.id, clientAddress: clientAddress(getClientAddress), cf: platform?.cf, url });
```

`verifyUser` must check that the account is an admin. Refusals it throws with
a numeric `status` (SvelteKit's `error()`) become JSON responses with that
status. The salt, purpose, IndexedDB name and collections are fixed per app:
changing the salt or purpose invalidates every trusted phone.

The Firestore rules must keep browsers out of `phone_sign_in_requests` and
`trusted_phones`; only the server writes them.

## Tests

`pnpm test` runs the shared rules, the server pieces and Ringmaster's own route
and browser tests, ported to the package with Ringmaster's values.

## Updating consumers

Build, bump the version, `npm pack`, and copy the tarball into each app's
`vendor/` folder, then update the app's pinned `file:vendor/...` version and
run its checks.
