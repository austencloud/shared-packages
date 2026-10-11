// For the route tests, ported from Ringmaster's: calls a handler with the event
// SvelteKit hands a +server.ts route, the way an app's route file does, and
// throws refusals the way SvelteKit's error() does.
import { clientAddress, type RouteHandler } from './handlers';

/** SvelteKit's error(): throws an HttpError-shaped object. */
export function error(status: number, message: string): never {
	throw Object.assign(new Error(message), { status, body: { message } });
}

export interface RouteEvent {
	request: Request;
	url?: URL;
	params?: { id?: string };
	platform?: { cf?: Record<string, unknown> };
	getClientAddress?: () => string;
}

/** The handler as a SvelteKit route: what an app's +server.ts does with it. */
export function asRoute(handler: RouteHandler): (event: RouteEvent) => Promise<Response> {
	return (event) =>
		handler(event.request, {
			id: event.params?.id,
			clientAddress: clientAddress(() => {
				if (!event.getClientAddress) throw new Error('no client address');
				return event.getClientAddress();
			}),
			cf: event.platform?.cf,
			url: event.url
		});
}

/** Ringmaster's values, which its route tests were written against. */
export const RINGMASTER = {
	appName: 'Ringmaster',
	liveOrigin: 'https://ringmaster.cirqueaflame.com',
	salt: 'ringmaster-phone-sign-in',
	autoPurpose: 'ringmaster-phone-sign-in-auto',
	projectId: 'cirque-aflame'
} as const;

/** The key material the server keys come from in these tests. */
export const testServerSecret = () => new TextEncoder().encode('test service account private key');

/** For config a test file never reaches. */
export const notUsed = (): never => {
	throw new Error('not used by these tests');
};
