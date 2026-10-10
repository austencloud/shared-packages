import { describe, expect, it } from 'vitest';
import { createRecordResolver, decideRouteMotion } from './route-morph';

const target = (id: string | null, params: Record<string, string> = {}) => ({ route: { id }, params });

describe('createRecordResolver', () => {
	const recordOf = createRecordResolver({
		'/performers/[id]': { kind: 'performer', params: ['id'] },
		'/services/[category]/[service]': { kind: 'service', params: ['category', 'service'] }
	});

	it('names a record page from one param', () => {
		expect(recordOf(target('/performers/[id]', { id: 'abc' }))).toBe('performer:abc');
	});

	it('joins several params with a slash', () => {
		expect(recordOf(target('/services/[category]/[service]', { category: 'fire', service: 'fire-show' }))).toBe(
			'service:fire/fire-show'
		);
	});

	it('returns null for other routes, a missing param or no target', () => {
		expect(recordOf(target('/performers'))).toBeNull();
		expect(recordOf(target('/services/[category]/[service]', { category: 'fire' }))).toBeNull();
		expect(recordOf(null)).toBeNull();
		expect(recordOf(undefined)).toBeNull();
	});
});

describe('decideRouteMotion', () => {
	const base = { fromPath: '/skills', toPath: '/performers/abc', supported: true, reduced: false, hasSource: true };

	it('morphs when a record source is known', () => {
		expect(decideRouteMotion(base)).toBe('morph');
	});

	it('fades when there is no source', () => {
		expect(decideRouteMotion({ ...base, hasSource: false })).toBe('fade');
	});

	it('does nothing for a query-only change', () => {
		expect(decideRouteMotion({ ...base, toPath: '/skills' })).toBe('none');
	});

	it('does nothing under reduced motion or without support', () => {
		expect(decideRouteMotion({ ...base, reduced: true })).toBe('none');
		expect(decideRouteMotion({ ...base, supported: false })).toBe('none');
	});
});
