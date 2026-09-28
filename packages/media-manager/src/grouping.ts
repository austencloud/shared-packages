// Group media items by shoot/event using filename, upload time, and EXIF signals

export interface GroupableMediaItem { id: string; name: string; createdAt?: Date | null; exif?: { dateTaken?: Date | string | null } | null }

export interface PhotoGroup<T extends GroupableMediaItem = GroupableMediaItem> {
	id: string;
	label: string;
	items: T[];
}

// A burst is a tight cluster of nearly identical shots within a group
export interface Burst<T extends GroupableMediaItem = GroupableMediaItem> {
	startIndex: number; // Index into the group's items array
	endIndex: number;   // Inclusive
	items: T[];
}

const BURST_NUMBER_GAP = 3; // Sequential filename numbers within 3 = same burst
const BURST_EXIF_MS = 30 * 1000; // Photos taken within 30 seconds = same burst
const BURST_UPLOAD_MS = 10 * 1000; // Uploaded within 10 seconds = same burst

const GENERIC_PREFIXES = new Set(['DSC', 'IMG', 'IMG_', 'EMC', 'PXL_', 'FB_IMG_', 'FB_IMG']);
const GENERIC_NUMBER_GAP = 20;
const DESCRIPTIVE_NUMBER_GAP = 100;
const UPLOAD_PROXIMITY_MS = 5 * 60 * 1000; // 5 minutes
const EXIF_PROXIMITY_MS = 30 * 60 * 1000; // 30 minutes
const MAX_GROUP_SIZE = 50;

interface ParsedName {
	prefix: string;
	number: number | null;
}

function parseName(name: string): ParsedName {
	// Named series: "Agudath Jacob Fire Photos (19 of 62)"
	const seriesMatch = name.match(/^(.+?)\s*[\(\[]\d+/);
	if (seriesMatch) {
		const numMatch = name.match(/[\(\[](\d+)/);
		return { prefix: seriesMatch[1]!.trim(), number: numMatch ? parseInt(numMatch[1]!) : null };
	}

	// Date-prefixed: "251108-Paulina-Conner-Wedding-0694"
	const datePrefixMatch = name.match(/^(\d{6}-[A-Za-z-]+-)\d+/);
	if (datePrefixMatch) {
		const numMatch = name.match(/(\d+)[_.]?\w*$/);
		return { prefix: datePrefixMatch[1]!, number: numMatch ? parseInt(numMatch[1]!) : null };
	}

	// PXL timestamp: group by same minute
	const pxlMatch = name.match(/^(PXL_\d{8}_\d{4})/);
	if (pxlMatch) {
		return { prefix: pxlMatch[1]!, number: null };
	}

	// Generic sequential: DSC00680, IMG_3569, EMC10900
	const seqMatch = name.match(/^([A-Za-z_]+)(\d+)/);
	if (seqMatch) {
		return { prefix: seqMatch[1]!, number: parseInt(seqMatch[2]!) };
	}

	return { prefix: '__standalone__', number: null };
}

function shouldGroupByFilename(a: ParsedName, b: ParsedName): boolean {
	if (a.prefix !== b.prefix) return false;
	if (a.prefix === '__standalone__') return false;
	if (a.number === null || b.number === null) return true; // Same prefix, no numbers = group
	const gap = GENERIC_PREFIXES.has(a.prefix) ? GENERIC_NUMBER_GAP : DESCRIPTIVE_NUMBER_GAP;
	return Math.abs(a.number - b.number) <= gap;
}

// Union-Find
function createUnionFind(ids: string[]) {
	const parent = new Map<string, string>();
	ids.forEach(id => parent.set(id, id));

	function find(id: string): string {
		while (parent.get(id) !== id) {
			parent.set(id, parent.get(parent.get(id)!)!); // path halving
			id = parent.get(id)!;
		}
		return id;
	}

	function union(a: string, b: string): void {
		const ra = find(a);
		const rb = find(b);
		if (ra !== rb) parent.set(ra, rb);
	}

	return { find, union };
}

export function groupPhotos<T extends GroupableMediaItem>(items: T[]): PhotoGroup<T>[] {
	if (items.length === 0) return [];

	const parsed = items.map(item => ({ item, parsed: parseName(item.name) }));
	const uf = createUnionFind(items.map(i => i.id));

	// Signal 1: Filename proximity (sorted by prefix + number)
	const sortedByName = [...parsed].sort((a, b) => {
		if (a.parsed.prefix !== b.parsed.prefix) return a.parsed.prefix.localeCompare(b.parsed.prefix);
		return (a.parsed.number ?? 0) - (b.parsed.number ?? 0);
	});

	for (let i = 0; i < sortedByName.length - 1; i++) {
		if (shouldGroupByFilename(sortedByName[i]!.parsed, sortedByName[i + 1]!.parsed)) {
			uf.union(sortedByName[i]!.item.id, sortedByName[i + 1]!.item.id);
		}
	}

	// Signal 2: Upload timestamp proximity — only for items with same prefix
	// (prevents unrelated uploads from merging just because they were uploaded together)
	const sortedByTime = [...parsed].sort((a, b) =>
		(a.item.createdAt?.getTime?.() ?? 0) - (b.item.createdAt?.getTime?.() ?? 0)
	);

	for (let i = 0; i < sortedByTime.length - 1; i++) {
		const a = sortedByTime[i]!;
		const b = sortedByTime[i + 1]!;
		const timeA = a.item.createdAt?.getTime?.() ?? 0;
		const timeB = b.item.createdAt?.getTime?.() ?? 0;
		if (timeB - timeA <= UPLOAD_PROXIMITY_MS && timeA > 0 && timeB > 0) {
			// Only merge if they share a prefix
			if (a.parsed.prefix === b.parsed.prefix && a.parsed.prefix !== '__standalone__') {
				uf.union(a.item.id, b.item.id);
			}
		}
	}

	// Signal 3: EXIF date proximity
	const withExif = parsed.filter(p => p.item.exif?.dateTaken);
	const sortedByExif = [...withExif].sort((a, b) => {
		const da = new Date(a.item.exif!.dateTaken!).getTime();
		const db = new Date(b.item.exif!.dateTaken!).getTime();
		return da - db;
	});

	for (let i = 0; i < sortedByExif.length - 1; i++) {
		const timeA = new Date(sortedByExif[i]!.item.exif!.dateTaken!).getTime();
		const timeB = new Date(sortedByExif[i + 1]!.item.exif!.dateTaken!).getTime();
		if (timeB - timeA <= EXIF_PROXIMITY_MS) {
			uf.union(sortedByExif[i]!.item.id, sortedByExif[i + 1]!.item.id);
		}
	}

	// Build groups from union-find
	const groupMap = new Map<string, T[]>();
	for (const item of items) {
		const root = uf.find(item.id);
		if (!groupMap.has(root)) groupMap.set(root, []);
		groupMap.get(root)!.push(item);
	}

	// Split oversized groups
	const finalGroups: T[][] = [];
	for (const members of groupMap.values()) {
		if (members.length <= MAX_GROUP_SIZE) {
			finalGroups.push(members);
		} else {
			const sorted = members.sort((a, b) => a.name.localeCompare(b.name));
			for (let i = 0; i < sorted.length; i += MAX_GROUP_SIZE) {
				finalGroups.push(sorted.slice(i, i + MAX_GROUP_SIZE));
			}
		}
	}

	// Convert to PhotoGroup objects, sorted by size descending
	return finalGroups
		.map(members => {
			const sorted = members.sort((a, b) => a.name.localeCompare(b.name));
			const firstParsed = parseName(sorted[0]!.name);
			const label = firstParsed.prefix === '__standalone__'
				? sorted[0]!.name
				: firstParsed.prefix.replace(/[-_]$/, '');

			return {
				id: `group-${sorted[0]!.id}`,
				label: members.length === 1 ? sorted[0]!.name : label,
				items: sorted,
			};
		})
		.sort((a, b) => b.items.length - a.items.length);
}

/**
 * Detect bursts (tight clusters of near-identical shots) within a sorted group.
 * Uses sequential filename numbers, EXIF timestamps, and upload timestamps.
 * Returns bursts with 2+ items only.
 */
export function detectBursts<T extends GroupableMediaItem>(items: T[]): Burst<T>[] {
	if (items.length < 2) return [];

	const parsed = items.map(item => ({ item, parsed: parseName(item.name) }));

	// For each consecutive pair, determine if they're in the same burst
	const sameAsPrev: boolean[] = [false]; // First item starts a new burst

	for (let i = 1; i < items.length; i++) {
		const prev = parsed[i - 1]!;
		const curr = parsed[i]!;
		let isBurst = false;

		// Signal 1: Sequential filenames with very small gap
		if (
			prev.parsed.prefix === curr.parsed.prefix &&
			prev.parsed.prefix !== '__standalone__' &&
			prev.parsed.number !== null &&
			curr.parsed.number !== null &&
			Math.abs(curr.parsed.number - prev.parsed.number) <= BURST_NUMBER_GAP
		) {
			isBurst = true;
		}

		// Signal 2: EXIF timestamps within 30 seconds
		if (!isBurst && prev.item.exif?.dateTaken && curr.item.exif?.dateTaken) {
			const timePrev = new Date(prev.item.exif.dateTaken).getTime();
			const timeCurr = new Date(curr.item.exif.dateTaken).getTime();
			if (Math.abs(timeCurr - timePrev) <= BURST_EXIF_MS) {
				isBurst = true;
			}
		}

		// Signal 3: Upload timestamps within 10 seconds
		if (!isBurst) {
			const uploadPrev = prev.item.createdAt?.getTime?.() ?? 0;
			const uploadCurr = curr.item.createdAt?.getTime?.() ?? 0;
			if (uploadPrev > 0 && uploadCurr > 0 && Math.abs(uploadCurr - uploadPrev) <= BURST_UPLOAD_MS) {
				isBurst = true;
			}
		}

		sameAsPrev.push(isBurst);
	}

	// Build burst ranges from the boolean array
	const bursts: Burst<T>[] = [];
	let burstStart = 0;

	for (let i = 1; i <= items.length; i++) {
		if (i === items.length || !sameAsPrev[i]) {
			// End of current run
			if (i - burstStart >= 2) {
				bursts.push({
					startIndex: burstStart,
					endIndex: i - 1,
					items: items.slice(burstStart, i),
				});
			}
			burstStart = i;
		}
	}

	return bursts;
}
