import { describe, expect, it } from 'vitest';
import { autoApprovalMessage } from './auto-message';

const PURPOSE = 'ringmaster-phone-sign-in-auto';

describe('autoApprovalMessage', () => {
	it('is the purpose, a NUL byte and the request id', () => {
		const message = autoApprovalMessage(PURPOSE, 'AbCdEfGhIjKlMnOpQr12');
		expect(new TextDecoder().decode(message)).toBe('ringmaster-phone-sign-in-auto\u0000AbCdEfGhIjKlMnOpQr12');
	});

	it('differs for two request ids, so a signature covers one request only', () => {
		const a = autoApprovalMessage(PURPOSE, 'AbCdEfGhIjKlMnOpQr12');
		const b = autoApprovalMessage(PURPOSE, 'AbCdEfGhIjKlMnOpQr13');
		expect(Array.from(a)).not.toEqual(Array.from(b));
	});

	it('differs between apps, so one app never accepts a signature made for another', () => {
		const a = autoApprovalMessage(PURPOSE, 'AbCdEfGhIjKlMnOpQr12');
		const b = autoApprovalMessage('flow-arts-phone-sign-in-auto', 'AbCdEfGhIjKlMnOpQr12');
		expect(Array.from(a)).not.toEqual(Array.from(b));
	});
});
