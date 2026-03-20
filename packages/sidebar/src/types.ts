import type { Snippet } from 'svelte';

export type ModuleId = string;

export interface Section {
	id: string;
	label: string;
	icon: string;
	color?: string;
	gradient?: string;
	disabled?: boolean;
	description?: string;
	metadata?: Record<string, unknown>;
}

export interface ModuleDefinition {
	id: ModuleId;
	label: string;
	icon: string;
	color?: string;
	description?: string;
	isMain?: boolean;
	sections: Section[];
	disabled?: boolean;
	disabledMessage?: string;
}

export interface SidebarProps {
	// Required
	modules: ModuleDefinition[];
	currentModule: string;
	currentSection: string;

	// Navigation
	onModuleChange?: (moduleId: string, targetSection?: string) => void | Promise<void>;
	onSectionChange?: (sectionId: string) => void;

	// Collapse
	collapsible?: boolean;
	collapsed?: boolean;
	collapseStorageKey?: string | null;

	// Optional callbacks (replace DI services)
	onHaptic?: () => void;
	translateLabel?: (moduleId: string) => string;
	translateSectionLabel?: (moduleId: string, sectionId: string, fallback: string) => string;
	filterSection?: (moduleId: string, sectionId: string) => boolean;
	getBadgeCount?: (moduleId: string, sectionId?: string) => number;
	onModuleHover?: (moduleId: string) => void;

	// Snippet slots
	renderIcon?: Snippet<[name: string, size: number]>;
	header?: Snippet<[collapsed: boolean]>;
	footer?: Snippet<[collapsed: boolean]>;

	// Styling
	class?: string;
}
