import type { Snippet } from 'svelte';

export interface Section {
	id: string;
	label: string;
	icon: string;
	color?: string;
	gradient?: string;
	disabled?: boolean;
	description?: string;
	/** Ties a section to a collapsible SectionGroup (optional grouping feature). */
	groupId?: string;
	metadata?: Record<string, unknown>;
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
	description?: string;
	isMain?: boolean;
	sections: Section[];
	/** Optional collapsible group headers (e.g. a Lab-style module). */
	groups?: SectionGroup[];
	disabled?: boolean;
	disabledMessage?: string;
}

export interface SidebarProps {
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
