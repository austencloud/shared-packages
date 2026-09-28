import test from 'node:test';
import assert from 'node:assert/strict';
import { detectBursts, groupPhotos } from '../dist/grouping.js';

const photo = (id, name, dateTaken, createdAt) => ({
	id, name,
	exif: dateTaken ? { dateTaken: new Date(dateTaken) } : undefined,
	createdAt: createdAt ? new Date(createdAt) : undefined
});

test('groups a filename series without merging unrelated photos uploaded together', () => {
	const items = [
		photo('a', 'IMG_0100.jpg', null, '2026-01-01T12:00:00Z'),
		photo('b', 'IMG_0101.jpg', null, '2026-01-01T12:00:01Z'),
		photo('c', 'backyard.jpg', null, '2026-01-01T12:00:02Z')
	];
	const groups = groupPhotos(items);
	assert.deepEqual(groups.map(group => group.items.map(item => item.id)), [['a', 'b'], ['c']]);
	assert.equal(items[0].id, 'a');
});

test('capture times group photos from the same shoot even when names differ', () => {
	const items = [
		photo('a', 'camera-a.jpg', '2026-01-01T12:00:00Z'),
		photo('b', 'camera-b.jpg', '2026-01-01T12:05:00Z'),
		photo('c', 'camera-c.jpg', '2026-01-02T12:00:00Z')
	];
	assert.deepEqual(groupPhotos(items).map(group => group.items.map(item => item.id)), [['a', 'b'], ['c']]);
});

test('bursts use close capture times or sequential names and preserve item positions', () => {
	const items = [
		photo('a', 'IMG_0100.jpg'),
		photo('b', 'IMG_0102.jpg'),
		photo('c', 'different.jpg', '2026-01-01T12:00:00Z'),
		photo('d', 'another.jpg', '2026-01-01T12:00:20Z'),
		photo('e', 'later.jpg', '2026-01-01T13:00:00Z')
	];
	assert.deepEqual(detectBursts(items).map(burst => ({
		start: burst.startIndex, end: burst.endIndex, ids: burst.items.map(item => item.id)
	})), [
		{ start: 0, end: 1, ids: ['a', 'b'] },
		{ start: 2, end: 3, ids: ['c', 'd'] }
	]);
});
