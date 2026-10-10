// Finds motion written outside the motion owners: transitions
// imported straight from Svelte, `transition: all`, and durations or easing
// curves typed as raw values instead of the clock's tokens.
// Each app's coverage test runs it over its src/ and lists its own exemptions.
import fs from 'node:fs';
import path from 'node:path';

export type Finding = { file: string; rule: string; text: string };

const TIMED = new Set([
	'transition',
	'transition-duration',
	'transition-delay',
	'animation',
	'animation-duration',
	'animation-delay',
]);
// Zero is no duration: reduced-motion overrides write 0s.
const RAW_TIME = /(?<![\w.-])(?!0*\.?0+(ms|s)\b)\d*\.?\d+(ms|s)\b/;
const DIRECTIVE_DURATION = /\b(animate|in|out|transition):[\w.]+=\{\{[^}]*\bduration:\s*\d/;
// A type-only import (TransitionConfig) brings in no motion.
const SVELTE_TRANSITION = /import\s+(?!type\b)[^;]*?from\s+['"]svelte\/transition['"]/;
// Milliseconds typed into script code: a Web Animations call, a transition
// function's config, or a number handed to motionDuration.
const SCRIPT_DURATION = /\bduration:\s*\d{2,}|\bmotion(?:Duration)?\(\s*\d/;

function styleBlocks(source: string, file: string): string[] {
	if (file.endsWith('.css')) return [source];
	return [...source.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map((match) => match[1]);
}

function scanCss(css: string, file: string, findings: Finding[]) {
	const clean = css.replace(/\/\*[\s\S]*?\*\//g, '');
	for (const chunk of clean.split(/[;{}]/)) {
		const match = /^\s*([a-z-]+)\s*:\s*([\s\S]+?)\s*$/.exec(chunk);
		if (!match) continue;
		const [, property, value] = match;
		// Custom properties are where the clock's tokens are defined.
		if (property.startsWith('--')) continue;
		const text = `${property}: ${value.replace(/\s+/g, ' ')}`;
		if ((property === 'transition' || property === 'transition-property') && /^all\b/.test(value)) {
			findings.push({ file, rule: 'transition: all', text });
		}
		// A loop (a spinner, a pulse) keeps its own pace; the clock is for changes.
		if (TIMED.has(property) && RAW_TIME.test(value) && !/\binfinite\b/.test(value)) {
			findings.push({ file, rule: 'raw duration', text });
		}
		if (value.includes('cubic-bezier(')) findings.push({ file, rule: 'raw easing', text });
	}
}

export function scanSource(source: string, file: string): Finding[] {
	const findings: Finding[] = [];
	if (SVELTE_TRANSITION.test(source)) {
		findings.push({ file, rule: 'svelte/transition import', text: 'imports svelte/transition' });
	}
	const script = file.endsWith('.css') ? '' : source.replace(/<style[^>]*>[\s\S]*?<\/style>/g, '');
	for (const line of script.split('\n')) {
		if (/^\s*(\/\/|\/?\*)/.test(line)) continue;
		if (file.endsWith('.svelte') && DIRECTIVE_DURATION.test(line)) {
			findings.push({ file, rule: 'raw directive duration', text: line.trim() });
		} else if (SCRIPT_DURATION.test(line)) {
			findings.push({ file, rule: 'raw script duration', text: line.trim() });
		}
	}
	for (const block of styleBlocks(source, file)) scanCss(block, file, findings);
	return findings;
}

/** Every finding under `root`, with paths relative to it in forward slashes. */
export function scanTree(root: string, skip: (relative: string) => boolean): Finding[] {
	const findings: Finding[] = [];
	const walk = (dir: string) => {
		for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
			const full = path.join(dir, entry.name);
			const relative = path.relative(root, full).split(path.sep).join('/');
			if (entry.isDirectory()) {
				walk(full);
				continue;
			}
			if (!/\.(svelte|css|ts)$/.test(entry.name) || /\.test\.ts$/.test(entry.name) || skip(relative)) continue;
			findings.push(...scanSource(fs.readFileSync(full, 'utf8'), relative));
		}
	};
	walk(root);
	return findings;
}
