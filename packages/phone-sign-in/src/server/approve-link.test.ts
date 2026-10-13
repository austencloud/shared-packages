import { describe, expect, it } from 'vitest';
import { approveUrl } from './approve-link';

const ID = 'AbCdEfGhIjKlMnOpQr12';
const LIVE = { liveOrigin: 'https://ringmaster.cirqueaflame.com' };

describe('approveUrl', () => {
	it('points at the live site from any server', () => {
		for (const origin of [
			'http://127.0.0.1:5231',
			'http://localhost:3000',
			'https://dev-ringmaster.cirqueaflame.com',
			LIVE.liveOrigin
		]) {
			expect(approveUrl(ID, origin, false, LIVE)).toBe(`https://ringmaster.cirqueaflame.com/sign-in/${ID}`);
		}
	});

	it('keeps the asking origin on an emulator-only server, which the live site cannot see', () => {
		expect(approveUrl(ID, 'http://127.0.0.1:5231', true, LIVE)).toBe(`http://127.0.0.1:5231/sign-in/${ID}`);
	});

	it("uses the app's own live origin and approve path", () => {
		expect(
			approveUrl(ID, 'https://localhost:5173', false, { liveOrigin: 'https://tkaflowarts.com', approvePath: '/approve' })
		).toBe(`https://tkaflowarts.com/approve/${ID}`);
	});
});
