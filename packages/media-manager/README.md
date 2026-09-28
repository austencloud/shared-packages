# Media manager

`@austencloud/media-manager` is the shared source for extracted media catalog rules used by Ringmaster and Taco Tuesday. A future personal library can use the same package. Each application owns its records, storage URLs, authentication, and persistence adapter.

## Shared catalog

Import pure rules from `@austencloud/media-manager/catalog`:

- Tag categories, labels, prerequisites, hierarchy, and entity link guards
- Media search and sorting
- Manual and smart collection selection
- Manual folder hierarchy, descendant lookup, valid parent choices, and unique item counts
- Storage-neutral item, tag, collection, and repository types

The package has no Firebase, Cloudflare, or browser dependency in this subpath. Put new catalog rules and their tests here before changing an application adapter. Ringmaster maps its Firestore records to these types; Taco Tuesday maps its D1 gallery records. A tag edit in one app does not automatically edit another app's database.

## Entity links

Import `@austencloud/media-manager/entity-links` for normalized name matching, skill aliases, linked-tag ownership, tag selection, and legacy-link validation. Supply skill registries and entity records from the application. These rules accept plain records and do not read or create data; each application still resolves IDs and performs transactions through its own adapter. Matching a name in separate application databases does not establish a shared canonical identity.

The root export contains reusable Svelte media management components. `@austencloud/media-spotlight` remains the shared viewer package. It is a separate package and version; a consumer must update its pinned version to receive viewer changes.

## Updating consumers

Build and test this package, bump its version, then update the vendored package in each app and run that app's checks. Both apps currently pin a tarball to keep builds reproducible. Updating this source alone does not update deployed clients.

The package repository is the source of truth for the rules above. App adapters should contain only database, authorization, URL, and app-specific UI code. Move any remaining duplicated catalog rules here as consumers adopt them.
