import type { Snippet } from 'svelte';

export interface Section {
	id: string;
	label: string;
	/** Optional. A section without an icon renders as a text row in the
	 *  expanded tree and is skipped in the rail (the rail shows icons only). */
	icon?: string;
	color?: string;
	gradient?: string;
	disabled?: boolean;
	/** Ties a section to a collapsible SectionGroup (optional grouping feature). */
	groupId?: string;
	/** Renders the row as a real `<a href>` (crawlable, router-interceptable)
	 *  instead of a `<button>`. onSectionChange/onModuleChange still fire on
	 *  click so a host can close its overlays; the anchor does the navigating. */
	href?: string;
	/** With `href`: adds the `download` attribute (a file link). */
	download?: boolean;
	/** Indent level in the expanded tree: 1 = a sub-row under the row above. */
	depth?: 0 | 1;
	// NOTE: only the fields the component reads are declared. Hosts may pass
	// richer section objects (extra fields are allowed) — the contract stays a
	// minimal structural subset so any host superset is assignable.
}

export interface SectionGroup {
	id: string;
	label: string;
	icon?: string;
	color?: string;
	/** Present when a group is defined inline with its members; the tree reads
	 *  membership from each Section's groupId, so this is optional. */
	sections?: Section[];
}

export interface ModuleDefinition {
	id: string;
	label: string;
	icon: string;
	color?: string;
	isMain?: boolean;
	sections: Section[];
	/** Optional collapsible group headers (e.g. a Lab-style module). */
	groups?: SectionGroup[];
	disabled?: boolean;
	disabledMessage?: string;
	/** Renders the module row as a real `<a href>`. Rail tap (or a module with
	 *  no sections) follows the link; an expanded tap on a module WITH sections
	 *  still toggles its section list instead of navigating. */
	href?: string;
	/** With `href`: adds the `download` attribute. */
	download?: boolean;
}

export interface SidebarProps {
	/** Localized names for package-owned navigation controls. */
	navigationLabel?: string;
	homeLabel?: string;
	pinLabel?: string;
	collapseLabel?: string;

	// Data
	modules: ModuleDefinition[];
	currentModule: string;
	currentSection: string;

	// Navigation
	onModuleChange?: (moduleId: string, targetSection?: string) => void | Promise<void>;
	onSectionChange?: (sectionId: string) => void;
	onModuleContextMenu?: (moduleId: string, e: MouseEvent) => void;
	onSectionContextMenu?: (moduleId: string, sectionId: string, e: MouseEvent) => void;
	onModuleHover?: (moduleId: string) => void;

	// Interaction — hover-expand overlay is THE model
	pinned?: boolean;
	pinStorageKey?: string | null;
	railWidth?: number;
	expandedWidth?: number;
	hoverIntent?: { openDelay?: number; closeDelay?: number };
	disableHoverExpand?: boolean;
	/** Host-controlled: keep the hover overlay open while an anchored popover or
	 *  context menu (rendered by the host) is showing, so it doesn't orphan. */
	holdOpen?: boolean;
	onReservedWidthChange?: (px: number) => void;

	// DI adapters (replace host services)
	onHaptic?: () => void;
	translateLabel?: (moduleId: string) => string;
	translateSectionLabel?: (moduleId: string, sectionId: string, fallback: string) => string;
	filterSection?: (moduleId: string, sectionId: string) => boolean;
	getBadgeCount?: (moduleId: string, sectionId?: string) => number;

	// Chrome — structured props get the shared slide-reveal; snippet = escape hatch
	homeHref?: string | null;
	brandLead?: Snippet | string;
	brandRest?: Snippet | string;
	brand?: Snippet<[expanded: boolean]>;

	// Slots
	renderIcon?: Snippet<[name: string, size: number]>;
	beforeTree?: Snippet<[expanded: boolean]>;
	account?: Snippet<[expanded: boolean]>;
	footer?: Snippet<[expanded: boolean]>;

	// Styling
	class?: string;
}
