import { describe, expect, it } from 'vitest';
import { isApprovePagePath, loginPathFor, safeNext } from './login-next';

const ID = 'AbCdEfGhIjKlMnOpQr12';
const PATH = `/sign-in/${ID}`;
const BACKSLASH = String.fromCharCode(92);
const encode = (value: string) => `next=${encodeURIComponent(value)}`;

describe('safeNext', () => {
	it('returns an approve page path, from a string or from parsed params', () => {
		expect(safeNext(encode(PATH))).toBe(PATH);
		expect(safeNext(`?${encode(PATH)}`)).toBe(PATH);
		expect(safeNext(`next=${PATH}`)).toBe(PATH);
		expect(safeNext(new URLSearchParams(encode(PATH)))).toBe(PATH);
		expect(safeNext(new URL(`https://ringmaster.example/login?${encode(PATH)}`).searchParams)).toBe(PATH);
	});

	it('uses the dashboard when there is no next, or it is empty', () => {
		expect(safeNext('')).toBe('/');
		expect(safeNext('?')).toBe('/');
		expect(safeNext('other=1')).toBe('/');
		expect(safeNext('next=')).toBe('/');
		expect(safeNext(new URLSearchParams())).toBe('/');
	});

	it.each([
		['a protocol-relative URL', '//evil.com'],
		['a protocol-relative URL that ends like an approve page', `//evil.com${PATH}`],
		['an absolute URL', 'https://evil.com'],
		['an absolute URL to an approve page path elsewhere', `https://evil.com${PATH}`],
		['a javascript URL', 'javascript:alert(1)'],
		['a data URL', 'data:text/html,<script>alert(1)</script>'],
		['a backslash host', `/${BACKSLASH}evil.com`],
		['a backslash before the path', `/${BACKSLASH}sign-in/${ID}`],
		['backslashes in place of slashes', `${BACKSLASH}sign-in${BACKSLASH}${ID}`],
		['another page of the app', '/events'],
		['the dashboard written out', '/'],
		['the login page', '/login'],
		['an api route', `/api/phone-sign-in/${ID}/decision`],
		['an extra path segment', `${PATH}/extra`],
		['a trailing slash', `${PATH}/`],
		['a query string', `${PATH}?x=1`],
		['a fragment', `${PATH}#x`],
		['a leading space', ` ${PATH}`],
		['a trailing space', `${PATH} `],
		['a trailing newline', `${PATH}\n`],
		['a tab inside', `/sign-in/\t${ID}`],
		['a short id', '/sign-in/AbCdEfGhIjKlMnOpQr1'],
		['a long id', '/sign-in/AbCdEfGhIjKlMnOpQr123'],
		['an id with a dash', '/sign-in/AbCdEfGhIjKlMnOpQr-2'],
		['an id with a dot segment', '/sign-in/../events'],
		['a dot segment after the id', `${PATH}/..`],
		['a dot segment before it', `/x/../sign-in/${ID}`],
		['a different case of the folder', `/Sign-In/${ID}`],
		['no leading slash', `sign-in/${ID}`],
		['the folder alone', '/sign-in'],
		['a percent-encoded slash inside the path', `/sign-in%2F${ID}`],
		['an id padded with an encoded dot', `/sign-in/${ID.slice(0, 19)}%2e`],
		['a null byte', `${PATH}\u0000`]
	])('refuses %s', (_label, value) => {
		expect(safeNext(encode(value))).toBe('/');
		expect(safeNext(new URLSearchParams({ next: value }))).toBe('/');
	});

	it('does not decode twice, so an encoded trick stays inert', () => {
		// Decodes once to the text "%2F%2Fevil.com", which is not a path.
		expect(safeNext(`next=${encodeURIComponent(encodeURIComponent('//evil.com'))}`)).toBe('/');
		// Decodes once to "%2Fsign-in%2F<id>", which is also not the path itself.
		expect(safeNext(`next=${encodeURIComponent(encodeURIComponent(PATH))}`)).toBe('/');
		// An unencoded raw value can't smuggle a second next either.
		expect(safeNext(`next=//evil.com&next=${PATH}`)).toBe('/');
	});

	it('reads the first next when there are several', () => {
		expect(safeNext(`${encode(PATH)}&next=//evil.com`)).toBe(PATH);
	});
});

describe('loginPathFor', () => {
	it('remembers an approve page', () => {
		expect(loginPathFor(PATH)).toBe(`/login?next=${encodeURIComponent(PATH)}`);
	});

	it('round-trips through safeNext', () => {
		const url = new URL(loginPathFor(PATH), 'https://ringmaster.example');
		expect(url.pathname).toBe('/login');
		expect(safeNext(url.searchParams)).toBe(PATH);
	});

	it.each([
		'/',
		'/events',
		'/login',
		'/sign-in',
		'/sign-in/short',
		`${PATH}/extra`,
		`${PATH}/`,
		'//evil.com',
		`/sign-in/${ID}\n`,
		`/api/phone-sign-in/${ID}`
	])('sends %s to the plain login page', (pathname) => {
		expect(loginPathFor(pathname)).toBe('/login');
	});
});

describe('other page paths', () => {
	it('honors an app whose approve pages and login page live elsewhere', () => {
		const paths = { approvePath: '/phone/approve', loginPath: '/account/login' };
		expect(isApprovePagePath(`/phone/approve/${ID}`, paths.approvePath)).toBe(true);
		expect(isApprovePagePath(PATH, paths.approvePath)).toBe(false);
		expect(safeNext(encode(`/phone/approve/${ID}`), paths)).toBe(`/phone/approve/${ID}`);
		expect(safeNext(encode(PATH), paths)).toBe('/');
		expect(loginPathFor(`/phone/approve/${ID}`, paths)).toBe(
			`/account/login?next=${encodeURIComponent(`/phone/approve/${ID}`)}`
		);
		expect(loginPathFor('/elsewhere', paths)).toBe('/account/login');
	});
});
