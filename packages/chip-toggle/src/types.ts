export type ColorPreset =
	| 'default'
	| 'purple'
	| 'flame'
	| 'gold'
	| 'cyan'
	| 'blue'
	| 'lime'
	| 'amber'
	| 'rose'
	| 'emerald'
	| 'red'
	| 'gray';

export interface ChipToggleProps {
	label?: string;
	/** FontAwesome icon class, e.g. "fa-star" renders as `<i class="fas fa-star">`. */
	icon?: string;
	active?: boolean;
	color?: ColorPreset;
	size?: 'sm' | 'md' | 'lg';
	layout?: 'horizontal' | 'vertical';
	disabled?: boolean;
	onclick?: () => void;
}

export interface ChipGroupProps {
	label?: string;
	layout?: 'horizontal' | 'vertical';
	variant?: 'row' | 'grid';
	columns?: 2 | 3 | 4;
	gap?: 'sm' | 'md' | 'lg';
	wrap?: boolean;
}
