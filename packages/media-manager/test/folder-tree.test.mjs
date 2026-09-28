import test from 'node:test';
import assert from 'node:assert/strict';
import { buildFolderTree, getDescendantIds, getValidParentOptions, getAggregateItemCount } from '../dist/catalog.js';

const folder = (id, parentId, itemIds = [], type = 'manual') => ({ id, parentId, itemIds, type });

test('builds manual hierarchy in input order and promotes orphans', () => {
	const collections = [folder('root', null), folder('child', 'root'), folder('orphan', 'missing'), folder('smart', null, [], 'smart')];
	const roots = buildFolderTree(collections);
	assert.deepEqual(roots.map(({ collection }) => collection.id), ['root', 'orphan']);
	assert.equal(roots[0].children[0].collection.id, 'child');
	assert.equal(roots[0].children[0].depth, 1);
});

test('excludes descendants and the deepest folders from parent choices', () => {
	const collections = [folder('root', null), folder('one', 'root'), folder('two', 'one'), folder('three', 'two'), folder('other', null)];
	assert.deepEqual(getDescendantIds(collections, 'one'), ['two', 'three']);
	assert.deepEqual(getValidParentOptions(collections, 'one').map(({ collection }) => collection.id), ['root', 'other']);
	assert.deepEqual(getValidParentOptions(collections).map(({ collection }) => collection.id), ['root', 'one', 'two', 'other']);
});

test('counts each loaded item once across descendants', () => {
	const collections = [folder('root', null, ['shared', 'one', 'unloaded']), folder('child', 'root', ['shared', 'two'])];
	const [root] = buildFolderTree(collections);
	assert.equal(getAggregateItemCount(root, collections, new Set(['shared', 'one', 'two'])), 3);
	assert.equal(getAggregateItemCount(root.children[0], collections), 2);
});

test('terminates traversal when malformed parent links cycle', () => {
	const collections = [folder('a', 'b'), folder('b', 'a')];
	assert.deepEqual(getDescendantIds(collections, 'a'), ['b', 'a']);
	assert.deepEqual(buildFolderTree(collections), []);
});
