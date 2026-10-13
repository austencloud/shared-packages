import { afterEach, describe, expect, it, vi } from 'vitest';
import { arrive, flyFade, growFade, leave, popIn } from './transitions';

function fakeNode(height: number, styles: Record<string, string>) {
	return {
		getBoundingClientRect: () => ({ height, width: 120 }),
		_styles: styles
	} as unknown as HTMLElement;
}

describe('motion owners', () => {
	afterEach(() => vi.unstubAllGlobals());

	it('growFade collapses height, padding, margin and border together', () => {
		vi.stubGlobal('window', { matchMedia: () => ({ matches: false }) });
		vi.stubGlobal('getComputedStyle', (n: { _styles: Record<string, string> }) => ({
			getPropertyValue: (p: string) => n._styles[p] ?? '0px'
		}));
		const config = growFade(fakeNode(40, { 'padding-top': '8px', 'padding-bottom': '6px', 'margin-top': '4px' }));
		expect(config.duration).toBe(200);
		const half = config.css!(0.5, 0.5);
		expect(half).toContain('height: 20px');
		expect(half).toContain('padding-top: 4px');
		expect(half).toContain('padding-bottom: 3px');
		expect(half).toContain('margin-top: 2px');
		expect(half).toContain('overflow: hidden');
	});

	it('arrive staggers by index and caps the delay', () => {
		vi.stubGlobal('window', { matchMedia: () => ({ matches: false }) });
		expect(arrive({} as Element, { index: 0 }).delay).toBe(110);
		expect(arrive({} as Element, { index: 3 }).delay).toBe(110 + 66);
		expect(arrive({} as Element, { index: 40 }).delay).toBe(110 + 220);
	});

	it('everything lands at once under reduced motion', () => {
		vi.stubGlobal('window', { matchMedia: () => ({ matches: true }) });
		expect(arrive({} as Element, { index: 5 })).toMatchObject({ delay: 0, duration: 0 });
		expect(leave({} as Element).duration).toBe(0);
		expect(popIn({} as HTMLElement).duration).toBe(0);
	});

	it('a leaver keeps the translate that pins it in place, whichever owner moves it', () => {
		vi.stubGlobal('window', { matchMedia: () => ({ matches: false }) });
		const pinned = { style: { transform: 'translate(0px, 240px)' } } as unknown as Element;
		expect(leave(pinned).css?.(0.5, 0.5)).toContain('transform: translate(0px, 240px) scale(');
		expect(popIn(pinned as HTMLElement).css?.(0.5, 0.5)).toContain('transform: translate(0px, 240px) scale(');
		expect(flyFade(pinned, { y: 8 }).css?.(0.5, 0.5)).toContain('transform: translate(0px, 240px) translate(0px, 4px)');
		expect(leave({} as Element).css?.(0.5, 0.5)).toContain('transform: scale(');
	});
});
