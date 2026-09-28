import test from 'node:test';
import assert from 'node:assert/strict';
import {
	assertLegacyTagMatchesEntity, assertTagOwner, findNamedEntity, resolveSkillIdentity,
	selectTagForEntity, tagBelongsToEntity
} from '../dist/entity-links.js';

const identity = { id: 'person-1', collection: 'performers' };
const tag = (id, overrides = {}) => ({ id, name: 'Alex', category: 'performer', ...overrides });
const categories = { performer: 'performers', prop: 'props', event: 'events', skill: 'config:subspecialties' };

test('skill aliases and registries resolve to typed identities without storage', () => {
	const disciplines = [{ key: 'juggling', name: 'Juggling' }, { key: 'aerial', name: 'Aerial' }];
	const subspecialties = [{ key: 'poi', name: 'Fire Poi' }, { key: 'duplicate', name: 'Same' }, { key: 'duplicate-2', name: 'same' }];
	assert.deepEqual(resolveSkillIdentity('  FLOW ARTS ', disciplines, subspecialties), { id: 'juggling', collection: 'config:disciplines' });
	assert.deepEqual(resolveSkillIdentity('Fire Poi', disciplines, subspecialties), { id: 'poi', collection: 'config:subspecialties' });
	assert.equal(resolveSkillIdentity('Same', disciplines, subspecialties), null);
	assert.equal(resolveSkillIdentity('Unknown', disciplines, subspecialties), null);
});

test('named entity matching rejects duplicates across performer, prop, event, and skill stores', () => {
	for (const collection of ['performers', 'props', 'events', 'skills']) {
		assert.deepEqual(findNamedEntity('  ALEX ', collection, [{ id: 'one', name: 'alex' }], 'ambiguous'), { id: 'one', collection });
		assert.equal(findNamedEntity('Other', collection, [{ id: 'one', name: 'alex' }], 'ambiguous'), null);
		assert.throws(() => findNamedEntity('Alex', collection, [
			{ id: 'one', name: 'Alex' }, { id: 'two', name: ' alex ' }
		], 'ambiguous'), /ambiguous/);
	}
});

test('tag selection prefers the canonical link and refuses ambiguous or claimed legacy tags', () => {
	const entity = { id: identity.id, name: 'Alex' };
	const linked = tag('linked', { linkedEntityId: identity.id, linkedCollection: identity.collection });
	assert.equal(selectTagForEntity([tag('unlinked'), linked], entity, 'performers', 'performer'), linked);
	assert.equal(selectTagForEntity([tag('unlinked')], entity, 'performers', 'performer')?.id, 'unlinked');
	assert.equal(selectTagForEntity([], entity, 'performers', 'performer'), null);
	assert.throws(() => selectTagForEntity([tag('one'), tag('two', { name: ' alex ' })], entity, 'performers', 'performer'), /Multiple unlinked/);
	assert.throws(() => selectTagForEntity([tag('claimed', { linkedEntityId: 'other', linkedCollection: 'performers' })], entity, 'performers', 'performer'), /already belongs/);
	assert.equal(tagBelongsToEntity(linked, identity), true);
	assert.throws(() => assertTagOwner(tag('partial', { linkedEntityId: 'other' }), identity), /already belongs/);
});

test('legacy validation requires a matching canonical entity, skill identity, or unique skill name', () => {
	assert.doesNotThrow(() => assertLegacyTagMatchesEntity(tag('legacy'), identity, {
		categoryCollections: categories, entity: { name: ' alex ', mediaTagId: 'legacy' }
	}));
	assert.throws(() => assertLegacyTagMatchesEntity(tag('legacy', { category: 'prop' }), identity, {
		categoryCollections: categories, entity: { name: 'Alex', mediaTagId: 'legacy' }
	}), /does not match/);
	assert.throws(() => assertLegacyTagMatchesEntity(tag('legacy'), identity, {
		categoryCollections: categories, entity: { name: 'Alex', mediaTagId: 'different' }
	}), /does not match/);
	assert.throws(() => assertLegacyTagMatchesEntity(tag('legacy', { linkedEntityId: 'other', linkedCollection: 'performers' }), identity, {
		categoryCollections: categories
	}), /another entity/);
	const skillTag = tag('skill-tag', { name: 'Flow Arts', category: 'skill' });
	const skill = { id: 'juggling', collection: 'config:disciplines' };
	assert.doesNotThrow(() => assertLegacyTagMatchesEntity(skillTag, skill, { categoryCollections: categories, resolvedSkill: skill }));
	assert.throws(() => assertLegacyTagMatchesEntity(skillTag, skill, { categoryCollections: categories, resolvedSkill: null }), /does not match/);
	assert.doesNotThrow(() => assertLegacyTagMatchesEntity(skillTag, { id: 'one', collection: 'skills' }, {
		categoryCollections: categories, uniqueSkillName: 'flow arts'
	}));
	assert.throws(() => assertLegacyTagMatchesEntity(skillTag, { id: 'one', collection: 'skills' }, {
		categoryCollections: categories, uniqueSkillName: null
	}), /does not match/);
});
