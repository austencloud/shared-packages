import test from 'node:test';
import assert from 'node:assert/strict';
import {
	DEFAULT_SMART_FILTERS, addCollectionItems, assertTagCanChangeCategory,
	assertTagCanDelete, assertTagsCanMerge, buildTagTree, filterMediaItems,
	getCollectionItems, getVisibleTagsByCategory, reparentTag
} from '../dist/catalog.js';

const date = new Date('2024-06-01T00:00:00Z');
const tag = (id, parentId = null, path = [id], prereqTagIds) => ({
	id, name: id, color: 'gray', category: 'content', parentId, path,
	depth: path.length - 1, aliases: [], prereqTagIds, createdAt: date, updatedAt: date
});
const item = (id, tags, extras = {}) => ({
	id, name: id, type: 'image', size: 1, url: id, tags,
	createdAt: date, updatedAt: date, ...extras
});
const collection = (type, filters = null, itemIds = []) => ({
	id: 'c', name: 'c', description: '', type, parentId: null,
	itemIds, filters, createdAt: date, updatedAt: date
});

test('category and tag prerequisites use OR rules', () => {
	const groups = new Map([['content', [{ tag: tag('open') }, { tag: tag('gated', null, ['gated'], ['a', 'b']) }]]]);
	assert.deepEqual([...getVisibleTagsByCategory(['content'], groups, [], {}).get('content')].map((entry) => entry.tag.id), ['open']);
	assert.equal(getVisibleTagsByCategory(['content'], groups, [], { content: ['a', 'b'] }).size, 0);
	assert.deepEqual(getVisibleTagsByCategory(['content'], groups, ['b'], { content: ['a', 'b'] }).get('content').map((entry) => entry.tag.id), ['open', 'gated']);
});

test('reparent updates descendant paths and tree counts without mutating input', () => {
	const tags = [tag('a'), tag('b', 'a', ['a', 'b']), tag('c', 'b', ['a', 'b', 'c']), tag('d')];
	const moved = reparentTag(tags, 'b', 'd');
	assert.deepEqual(moved[1].path, ['d', 'b']);
	assert.deepEqual(moved[2].path, ['d', 'b', 'c']);
	assert.deepEqual(tags[2].path, ['a', 'b', 'c']);
	assert.throws(() => reparentTag(tags, 'a', 'c'), /descendants/);
	const tree = buildTagTree(moved, [item('one', ['b', 'c']), item('two', ['c'])]);
	assert.equal(tree.find((node) => node.tag.id === 'd').descendantItemCount, 3);
});

test('smart and manual collections filter with tag, EXIF, query, and membership rules', () => {
	const items = [
		item('Lake', ['a'], { exif: { dateTaken: new Date('2024-06-01'), location: { latitude: 0, longitude: 0 } } }),
		item('Forest', ['b'], { exif: { dateTaken: new Date('2023-06-01') } }),
		item('Portrait', [])
	];
	const filters = { ...DEFAULT_SMART_FILTERS, tags: ['parent'], query: 'lak', yearTaken: 2024, hasLocation: true };
	assert.deepEqual(filterMediaItems(items, filters, () => ['a']).map((entry) => entry.id), []);
	assert.deepEqual(filterMediaItems(items, { ...filters, includeDescendants: true }, () => ['a']).map((entry) => entry.id), ['Lake']);
	assert.deepEqual(getCollectionItems(collection('smart', { ...DEFAULT_SMART_FILTERS, untaggedOnly: true }), items).map((entry) => entry.id), ['Portrait']);
	const manual = addCollectionItems(collection('manual', null, ['Lake']), ['Lake', 'Forest']);
	assert.deepEqual(manual.itemIds, ['Lake', 'Forest']);
	assert.deepEqual(getCollectionItems(manual, items).map((entry) => entry.id), ['Lake', 'Forest']);
});

test('entity-linked tags preserve canonical ownership', () => {
	const linked = { ...tag('one'), linkedEntityId: 'entity', linkedCollection: 'performers' };
	assert.throws(() => assertTagCanDelete(linked), /belongs to an entity/);
	assert.throws(() => assertTagCanChangeCategory(linked, 'performer'), /belongs to an entity/);
	assert.throws(() => assertTagCanChangeCategory(tag('free'), 'performer'), /canonical link/);
	assert.throws(() => assertTagsCanMerge(linked, tag('free')), /different entities/);
	assert.doesNotThrow(() => assertTagsCanMerge(linked, { ...linked, id: 'two' }));
});
