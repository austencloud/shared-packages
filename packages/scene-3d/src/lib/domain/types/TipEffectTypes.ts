export interface TipEffectAssignment {
	effectType: string;
	color?: string;
	intensity?: number;
}

export type TipEffectMap = Record<string, TipEffectAssignment>;
