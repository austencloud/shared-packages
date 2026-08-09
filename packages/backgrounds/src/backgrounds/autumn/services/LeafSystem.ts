import type {
  Leaf,
  LeafType,
  LeafSystemConfig,
} from "../domain/models/autumn-models.js";
import {
  AUTUMN_COLORS,
  AUTUMN_LEAF_SIZES,
  AUTUMN_LEAF_DISTRIBUTION,
  AUTUMN_PHYSICS,
  AUTUMN_OPACITY,
  AUTUMN_BOUNDS,
  AUTUMN_LEAF_PATHS,
} from "../domain/constants/autumn-constants.js";
import {
  getAutumnComposition,
  type AutumnLeafReleaseZone,
} from "../domain/autumn-composition.js";

export interface LeafSystem {
  leaves: Leaf[];
  initialize(config: LeafSystemConfig): void;
  update(windForce: number, frameMultiplier: number): void;
  draw(ctx: CanvasRenderingContext2D): void;
  resize(width: number, height: number): void;
  setParticleCount(count: number): void;
}

export function createLeafSystem(random: () => number = Math.random): LeafSystem {
  let leaves: Leaf[] = [];
  let canvasWidth = 0;
  let canvasHeight = 0;
  let targetParticleCount = 0;
  let releaseZones: AutumnLeafReleaseZone[] = [];
  const leafPathCache = new Map<string, Path2D>();

  function refreshReleaseZones(): void {
    releaseZones = getAutumnComposition({
      width: canvasWidth,
      height: canvasHeight,
    }).leafReleaseZones;
  }

  function getLeafType(): LeafType {
    const value = random();
    let cumulative = AUTUMN_LEAF_DISTRIBUTION.maple;
    if (value < cumulative) return "maple";

    cumulative += AUTUMN_LEAF_DISTRIBUTION.curved;
    if (value < cumulative) return "curved";

    cumulative += AUTUMN_LEAF_DISTRIBUTION.oak;
    if (value < cumulative) return "oak";

    cumulative += AUTUMN_LEAF_DISTRIBUTION.rounded;
    if (value < cumulative) return "rounded";

    cumulative += AUTUMN_LEAF_DISTRIBUTION.double;
    return value < cumulative ? "double" : "nature";
  }

  function getLeafColor(): string {
    const value = random();
    const colors = value < 0.3
      ? AUTUMN_COLORS.golds
      : value < 0.6
        ? AUTUMN_COLORS.oranges
        : value < 0.85
          ? AUTUMN_COLORS.reds
          : value < 0.95
            ? AUTUMN_COLORS.browns
            : AUTUMN_COLORS.greens;

    return colors[Math.floor(random() * colors.length)] ?? AUTUMN_COLORS.golds[0];
  }

  function pickReleaseZone(): AutumnLeafReleaseZone {
    const value = random();
    let cumulative = 0;

    for (const zone of releaseZones) {
      cumulative += zone.weight;
      if (value <= cumulative) return zone;
    }

    return releaseZones[releaseZones.length - 1] ?? {
      x: 0,
      y: 0,
      width: canvasWidth,
      height: canvasHeight * 0.25,
      weight: 1,
      drift: 0,
    };
  }

  function createLeaf(initialY?: number): Leaf {
    const type = getLeafType();
    const visualScale = Math.min(1.8, Math.max(0.75, Math.min(canvasWidth, canvasHeight) / 900));
    const sizeRange = AUTUMN_LEAF_SIZES[type];
    const depth = random();
    const depthScale = 0.68 + depth * 0.58;
    const size = (
      sizeRange.min + random() * (sizeRange.max - sizeRange.min)
    ) * visualScale * depthScale;
    const zone = pickReleaseZone();
    const releaseX = zone.x + random() * zone.width;
    const releaseY = zone.y + random() * zone.height;
    const y = initialY === undefined
      ? releaseY - random() * AUTUMN_BOUNDS.respawnBuffer
      : Math.max(releaseY, initialY);
    const descent = Math.max(0, (y - releaseY) / Math.max(canvasHeight, 1));
    const x = releaseX
      + descent * zone.drift * canvasWidth
      + (random() - 0.5) * descent * canvasWidth * 0.12;

    const motionScale = Math.min(1.75, Math.max(0.72, canvasHeight / 900));
    const sizeModifier = 1 - (size / (30 * visualScale)) * AUTUMN_PHYSICS.sizeSpeedFactor;
    const vy = (
      AUTUMN_PHYSICS.baseSpeed +
      random() * AUTUMN_PHYSICS.speedVariance * sizeModifier
    ) * motionScale;
    const baseVx = (
      (random() - 0.5) * 2 * AUTUMN_PHYSICS.baseDrift +
      (random() - 0.5) * AUTUMN_PHYSICS.driftVariance +
      zone.drift * 0.12
    ) * motionScale;
    const rotationSpeed =
      (random() < 0.5 ? 1 : -1) *
      (AUTUMN_PHYSICS.rotationSpeed.min +
        random() * (AUTUMN_PHYSICS.rotationSpeed.max - AUTUMN_PHYSICS.rotationSpeed.min));
    const tumbleSpeed =
      AUTUMN_PHYSICS.tumbleSpeed.min +
      random() * (AUTUMN_PHYSICS.tumbleSpeed.max - AUTUMN_PHYSICS.tumbleSpeed.min);
    const baseOpacity =
      AUTUMN_OPACITY.min + random() * (AUTUMN_OPACITY.max - AUTUMN_OPACITY.min);
    const spiralActive = random() < AUTUMN_PHYSICS.spiralChance;

    return {
      x,
      y,
      vx: baseVx,
      baseVx,
      vy,
      size,
      type,
      color: getLeafColor(),
      opacity: Math.max(0.22, baseOpacity - (1 - depth) * AUTUMN_OPACITY.depthFactor),
      rotation: random() * Math.PI * 2,
      rotationSpeed,
      tumblePhase: random() * Math.PI * 2,
      tumbleSpeed,
      depth,
      spiralPhase: spiralActive ? random() * Math.PI * 2 : undefined,
      spiralActive,
    };
  }

  function initialize(config: LeafSystemConfig): void {
    canvasWidth = config.canvasWidth;
    canvasHeight = config.canvasHeight;
    targetParticleCount = config.particleCount;
    refreshReleaseZones();
    leaves = [];

    const startY = canvasHeight * 0.16;
    const bandHeight = (canvasHeight - startY) / Math.max(targetParticleCount, 1);
    for (let index = 0; index < targetParticleCount; index += 1) {
      leaves.push(createLeaf(startY + (index + random()) * bandHeight));
    }

    leaves.sort((a, b) => a.depth - b.depth);
  }

  function update(windForce: number, frameMultiplier: number): void {
    for (const leaf of leaves) {
      const windResponse = 0.35 + leaf.depth * 0.65;
      const targetVx = leaf.baseVx + windForce * windResponse;
      const smoothing = Math.min(1, 0.045 * frameMultiplier);
      leaf.vx += (targetVx - leaf.vx) * smoothing;

      if (leaf.spiralActive && leaf.spiralPhase !== undefined) {
        leaf.spiralPhase += AUTUMN_PHYSICS.spiralSpeed * frameMultiplier;
        leaf.x += Math.sin(leaf.spiralPhase) * AUTUMN_PHYSICS.spiralRadius * frameMultiplier;
      }

      leaf.x += leaf.vx * frameMultiplier;
      leaf.y += leaf.vy * frameMultiplier;
      leaf.rotation += leaf.rotationSpeed * frameMultiplier;
      leaf.tumblePhase += leaf.tumbleSpeed * frameMultiplier;

      if (leaf.y > canvasHeight + AUTUMN_BOUNDS.respawnBuffer) {
        Object.assign(leaf, createLeaf());
      }

      if (leaf.x < -AUTUMN_BOUNDS.wrapMargin) {
        leaf.x = canvasWidth + AUTUMN_BOUNDS.wrapMargin;
      } else if (leaf.x > canvasWidth + AUTUMN_BOUNDS.wrapMargin) {
        leaf.x = -AUTUMN_BOUNDS.wrapMargin;
      }
    }
  }

  function createScaledPath(
    svgPath: string,
    viewBox: { width: number; height: number },
    targetSize: number
  ): Path2D {
    const scale = targetSize / Math.max(viewBox.width, viewBox.height);
    const matrix = new DOMMatrix();
    matrix.scaleSelf(scale, scale);
    matrix.translateSelf(-viewBox.width / 2, -viewBox.height / 2);

    const path = new Path2D();
    path.addPath(new Path2D(svgPath), matrix);
    return path;
  }

  function getLeafPath(type: LeafType, size: number): Path2D {
    const key = `${type}-${Math.round(size)}`;
    const cached = leafPathCache.get(key);
    if (cached) return cached;

    const leafData = AUTUMN_LEAF_PATHS[type];
    const path = createScaledPath(leafData.d, leafData.viewBox, size);
    leafPathCache.set(key, path);
    return path;
  }

  function adjustColorBrightness(hex: string, factor: number): string {
    const red = Math.min(255, Math.max(0, Math.round(parseInt(hex.slice(1, 3), 16) * factor)));
    const green = Math.min(255, Math.max(0, Math.round(parseInt(hex.slice(3, 5), 16) * factor)));
    const blue = Math.min(255, Math.max(0, Math.round(parseInt(hex.slice(5, 7), 16) * factor)));
    return `#${red.toString(16).padStart(2, "0")}${green.toString(16).padStart(2, "0")}${blue.toString(16).padStart(2, "0")}`;
  }

  function draw(ctx: CanvasRenderingContext2D): void {
    for (const leaf of leaves) {
      ctx.save();
      ctx.translate(leaf.x, leaf.y);
      ctx.rotate(leaf.rotation);
      ctx.scale(0.5 + 0.5 * Math.abs(Math.cos(leaf.tumblePhase)), 1);

      const path = getLeafPath(leaf.type, leaf.size);
      ctx.globalAlpha = leaf.opacity;
      ctx.fillStyle = leaf.color;
      ctx.fill(path);
      ctx.strokeStyle = adjustColorBrightness(leaf.color, 0.62);
      ctx.lineWidth = Math.max(0.35, leaf.size * 0.025);
      ctx.stroke(path);
      ctx.restore();
    }
  }

  function resize(width: number, height: number): void {
    const scaleX = canvasWidth > 0 ? width / canvasWidth : 1;
    const scaleY = canvasHeight > 0 ? height / canvasHeight : 1;
    canvasWidth = width;
    canvasHeight = height;
    refreshReleaseZones();

    for (const leaf of leaves) {
      leaf.x *= scaleX;
      leaf.y *= scaleY;
    }
  }

  function setParticleCount(count: number): void {
    targetParticleCount = count;
    while (leaves.length < targetParticleCount) leaves.push(createLeaf());
    if (leaves.length > targetParticleCount) leaves.length = targetParticleCount;
    leaves.sort((a, b) => a.depth - b.depth);
  }

  return {
    get leaves() {
      return leaves;
    },
    initialize,
    update,
    draw,
    resize,
    setParticleCount,
  };
}
