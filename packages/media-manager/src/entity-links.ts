/** Storage-neutral identity and tag-link rules. Callers supply their own entity registries. */
export type EntityIdentity = { id: string; collection: string };
export type NamedEntity = { id: string; name: string };
export type SkillRegistryEntry = { key: string; name: string };
export type EntityTag = { id: string; name: string; category: string; linkedEntityId?: string; linkedCollection?: string };

export const normalizeEntityName = (value: string): string => value.trim().toLocaleLowerCase();

const skillAliases: Record<string, EntityIdentity> = {
	fire: { id: 'fire', collection: 'config:disciplines' },
	led: { id: 'led', collection: 'config:disciplines' },
	aerials: { id: 'aerial', collection: 'config:disciplines' },
	balloons: { id: 'balloon', collection: 'config:disciplines' },
	stilts: { id: 'stilt', collection: 'config:disciplines' },
	acro: { id: 'acrobatics', collection: 'config:disciplines' },
	unicycle: { id: 'unicycle', collection: 'config:disciplines' },
	juggling: { id: 'juggling', collection: 'config:disciplines' },
	'flow arts': { id: 'juggling', collection: 'config:disciplines' },
	mime: { id: 'mime', collection: 'config:subspecialties' },
	clown: { id: 'clown', collection: 'config:subspecialties' }
};

export function resolveSkillIdentity(
	name: string, disciplines: readonly SkillRegistryEntry[], subspecialties: readonly SkillRegistryEntry[]
): EntityIdentity | null {
	const key = normalizeEntityName(name);
	if (skillAliases[key]) return { ...skillAliases[key] };
	const broad = disciplines.filter((item) => normalizeEntityName(item.name) === key);
	if (broad.length === 1) return { id: broad[0]!.key, collection: 'config:disciplines' };
	const specific = subspecialties.filter((item) => normalizeEntityName(item.name) === key);
	return specific.length === 1 ? { id: specific[0]!.key, collection: 'config:subspecialties' } : null;
}

/** Match an entity by normalized name, rejecting ambiguous names before a caller creates anything. */
export function findNamedEntity(
	name: string, collection: string, entities: readonly NamedEntity[], ambiguityMessage: string
): EntityIdentity | null {
	const matches = entities.filter((item) => normalizeEntityName(item.name) === normalizeEntityName(name));
	if (matches.length > 1) throw new Error(ambiguityMessage);
	return matches.length ? { id: matches[0]!.id, collection } : null;
}

export function tagBelongsToEntity(tag: EntityTag, identity: EntityIdentity): boolean {
	return tag.linkedEntityId === identity.id && tag.linkedCollection === identity.collection;
}

export function assertTagOwner(tag: EntityTag, identity: EntityIdentity): void {
	if ((tag.linkedEntityId || tag.linkedCollection) && !tagBelongsToEntity(tag, identity))
		throw new Error(`Tag "${tag.name}" already belongs to another entity.`);
}

/** Prefer an existing link, then one unique unlinked tag with the same category and name. */
export function selectTagForEntity<T extends EntityTag>(
	tags: readonly T[], entity: NamedEntity, collection: string, category: string
): T | null {
	const identity = { id: entity.id, collection };
	const linked = tags.find((tag) => tagBelongsToEntity(tag, identity));
	if (linked) return linked;
	const candidates = tags.filter((tag) => tag.category === category &&
		normalizeEntityName(tag.name) === normalizeEntityName(entity.name));
	if (candidates.some((tag) => tag.linkedEntityId || tag.linkedCollection))
		throw new Error(`Tag "${entity.name}" already belongs to another entity.`);
	if (candidates.length > 1) throw new Error(`Multiple unlinked ${category} tags named "${entity.name}" exist.`);
	return candidates[0] ?? null;
}

/** Verify a legacy tag before including its media with an entity's media. */
export function assertLegacyTagMatchesEntity(
	tag: EntityTag, identity: EntityIdentity, options: {
		categoryCollections: Readonly<Record<string, string>>;
		resolvedSkill?: EntityIdentity | null;
		uniqueSkillName?: string | null;
		entity?: { name?: unknown; mediaTagId?: unknown } | null;
	}
): void {
	if (tag.linkedEntityId || tag.linkedCollection) {
		if (!tagBelongsToEntity(tag, identity)) throw new Error('Legacy media tag belongs to another entity.');
		return;
	}
	if (identity.collection.startsWith('config:') || identity.collection === 'custom_subspecialties') {
		if (tag.category !== 'skill' || options.resolvedSkill?.id !== identity.id ||
			options.resolvedSkill.collection !== identity.collection)
			throw new Error('Legacy skill tag does not match this entity.');
		return;
	}
	if (identity.collection === 'skills') {
		if (tag.category !== 'skill' || !options.uniqueSkillName ||
			normalizeEntityName(tag.name) !== options.uniqueSkillName)
			throw new Error('Legacy skill tag does not match this skill.');
		return;
	}
	if (!options.entity || options.entity.mediaTagId !== tag.id ||
		options.categoryCollections[tag.category] !== identity.collection ||
		normalizeEntityName(tag.name) !== normalizeEntityName(String(options.entity.name ?? '')))
		throw new Error('Legacy media tag does not match this entity.');
}
