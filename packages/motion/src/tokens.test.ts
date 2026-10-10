import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { DURATION, EASE_STANDARD, EASE_STANDARD_IN, EASE_STANDARD_OUT, STAGGER } from './durations';

const css = fs.readFileSync(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../css/tokens.css'), 'utf8');
const token = (name: string) => new RegExp(`--${name}:\s*([^;]+);`).exec(css)?.[1].trim();

describe('css/tokens.css', () => {
	it('matches DURATION', () => {
		for (const [name, ms] of Object.entries(DURATION)) expect(token(`duration-${name}`)).toBe(`${ms}ms`);
	});

	it('matches STAGGER and the easing curves', () => {
		for (const [name, ms] of Object.entries(STAGGER)) expect(token(`stagger-${name}`)).toBe(`${ms}ms`);
		expect(token('ease-standard')).toBe(EASE_STANDARD);
		expect(token('ease-standard-out')).toBe(EASE_STANDARD_OUT);
		expect(token('ease-standard-in')).toBe(EASE_STANDARD_IN);
	});
});
