/**
 * SnapPoints - Manages snap point calculations for drawers
 *
 * Handles multiple height/width positions that a drawer can "snap" to.
 * Supports both absolute pixel values and percentage values.
 *
 * Example snap points: ["25%", "50%", "90%"] or [200, 400, 600]
 */

import type { SnapPointsOptions, SnapPointValue } from '../types.js';

export { type SnapPointValue, type SnapPointsOptions };

export class SnapPoints {
	private snapPointsPx: number[] = [];
	private currentIndex = 0;
	private containerSize = 0;

	constructor(private options: SnapPointsOptions) {
		this.options = {
			velocityThreshold: 0.5,
			distanceThreshold: 0.5,
			defaultSnapPoint: options.snapPoints.length - 1,
			...options
		};
		this.currentIndex = this.options.defaultSnapPoint!;
	}

	initialize(containerWidth: number, containerHeight: number) {
		const isHorizontal =
			this.options.placement === 'left' || this.options.placement === 'right';
		this.containerSize = isHorizontal ? containerWidth : containerHeight;
		this.calculateSnapPointsPx();
	}

	private calculateSnapPointsPx() {
		this.snapPointsPx = this.options.snapPoints.map((point) => {
			if (typeof point === 'number') return point;
			if (typeof point === 'string') {
				if (point.endsWith('%')) {
					const percent = parseFloat(point) / 100;
					return Math.round(this.containerSize * percent);
				}
				if (point.endsWith('px')) return parseFloat(point);
				return parseFloat(point) || 0;
			}
			return 0;
		});

		this.snapPointsPx.sort((a, b) => a - b);
	}

	getCurrentIndex(): number {
		return this.currentIndex;
	}

	getCurrentValue(): number {
		return this.snapPointsPx[this.currentIndex] ?? this.containerSize;
	}

	getSnapPointsPx(): number[] {
		return [...this.snapPointsPx];
	}

	getCount(): number {
		return this.snapPointsPx.length;
	}

	getTransformOffset(): number {
		const currentValue = this.getCurrentValue();
		return this.containerSize - currentValue;
	}

	calculateTargetSnapPoint(dragOffset: number, velocity: number, _duration: number): number {
		const currentValue = this.getCurrentValue();
		const { velocityThreshold, distanceThreshold } = this.options;

		const isDraggingToClose = dragOffset > 0;
		const effectiveSize = currentValue - Math.abs(dragOffset);

		let nearestIndex = this.currentIndex;
		let nearestDistance = Infinity;

		for (let i = 0; i < this.snapPointsPx.length; i++) {
			const distance = Math.abs(this.snapPointsPx[i]! - effectiveSize);
			if (distance < nearestDistance) {
				nearestDistance = distance;
				nearestIndex = i;
			}
		}

		const absVelocity = Math.abs(velocity);
		if (absVelocity > velocityThreshold!) {
			if (isDraggingToClose && this.currentIndex > 0) {
				return Math.max(0, nearestIndex - 1);
			} else if (!isDraggingToClose && this.currentIndex < this.snapPointsPx.length - 1) {
				return Math.min(this.snapPointsPx.length - 1, nearestIndex + 1);
			}
		}

		const thresholdDistance = Math.abs(
			(this.snapPointsPx[nearestIndex]! - (this.snapPointsPx[nearestIndex - 1] ?? 0)) *
				distanceThreshold!
		);

		if (Math.abs(dragOffset) > thresholdDistance) {
			if (isDraggingToClose && nearestIndex > 0) {
				return nearestIndex - 1;
			} else if (!isDraggingToClose && nearestIndex < this.snapPointsPx.length - 1) {
				return nearestIndex + 1;
			}
		}

		return nearestIndex;
	}

	setSnapPoint(index: number) {
		const clampedIndex = Math.max(0, Math.min(index, this.snapPointsPx.length - 1));
		if (clampedIndex !== this.currentIndex) {
			this.currentIndex = clampedIndex;
			this.options.onSnapPointChange?.(this.currentIndex, this.snapPointsPx[this.currentIndex]!);
		}
	}

	snapToClosest(dragOffset: number, velocity: number, duration: number): number {
		const targetIndex = this.calculateTargetSnapPoint(dragOffset, velocity, duration);
		this.setSnapPoint(targetIndex);
		return targetIndex;
	}

	isAtMinimum(): boolean {
		return this.currentIndex === 0;
	}

	isAtMaximum(): boolean {
		return this.currentIndex === this.snapPointsPx.length - 1;
	}

	expand(): boolean {
		if (this.currentIndex < this.snapPointsPx.length - 1) {
			this.setSnapPoint(this.currentIndex + 1);
			return true;
		}
		return false;
	}

	collapse(): boolean {
		if (this.currentIndex > 0) {
			this.setSnapPoint(this.currentIndex - 1);
			return true;
		}
		return false;
	}

	updateOptions(options: Partial<SnapPointsOptions>) {
		this.options = { ...this.options, ...options };
		if (options.snapPoints) {
			this.calculateSnapPointsPx();
			this.currentIndex = Math.min(this.currentIndex, this.snapPointsPx.length - 1);
		}
	}
}
