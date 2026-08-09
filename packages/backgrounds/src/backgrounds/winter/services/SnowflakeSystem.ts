import { WinterConfig } from "../../../core/domain/constants.js";
import type { Dimensions, QualityLevel } from "../../../core/domain/types.js";
import { DepthParallaxTracker } from "../../../core/services/DepthParallaxTracker.js";
import type {
  Snowflake,
  SnowOpticalClass,
} from "../domain/models/winter-models.js";
import {
  createSnowOpticalFields,
  getForegroundBirthX,
  getSnowBandTargets,
  type SnowBandTargets,
} from "../domain/snow-optics.js";
import {
  SnowVolumeRenderer,
  type SnowBandIndices,
} from "./SnowVolumeRenderer.js";
import { WinterCursorLightTracker } from "./WinterCursorLightTracker.js";
import { WinterWindField } from "./WinterWindField.js";

interface SnowflakeSystemOptions {
  random?: () => number;
  createImage?: () => HTMLImageElement;
}

interface MutableSnowBandIndices {
  powder: number[];
  crystal: number[];
  foreground: number[];
}

const WINTER_PARALLAX_PROFILE = {
  horizontalMaximum: 64,
  verticalMaximum: 34,
} as const;
const OPTICAL_FADE_PER_FRAME = 1 / 20;

export const createSnowflakeSystem = (options: SnowflakeSystemOptions = {}) => {
  const config = WinterConfig;
  const random = options.random ?? Math.random;
  const windField = new WinterWindField({ random });
  const parallaxTracker = new DepthParallaxTracker(WINTER_PARALLAX_PROFILE);
  const cursorLightTracker = new WinterCursorLightTracker();
  const renderer = new SnowVolumeRenderer(parallaxTracker, cursorLightTracker, {
    createImage: options.createImage,
  });
  const bandIndices: MutableSnowBandIndices = {
    powder: [],
    crystal: [],
    foreground: [],
  };
  let currentDimensions: Dimensions = { width: 1, height: 1 };
  let currentQuality: QualityLevel = "medium";
  let reducedMotion = false;
  let qualityConverged = true;

  const generateSnowflakeShape = (size: number): Path2D => {
    const path = new Path2D();
    const complexity = random() > 0.2 ? 2 : 1;
    const branchLength = size * (0.8 + random() * 0.4);

    for (let branch = 0; branch < 6; branch += 1) {
      const angle = (branch * Math.PI * 2) / 6;
      path.moveTo(0, 0);
      path.lineTo(
        Math.cos(angle) * branchLength,
        Math.sin(angle) * branchLength,
      );

      if (complexity === 1) continue;
      for (let sideBranch = 1; sideBranch <= 2; sideBranch += 1) {
        const branchPosition = sideBranch / 3;
        const branchX = Math.cos(angle) * branchLength * branchPosition;
        const branchY = Math.sin(angle) * branchLength * branchPosition;
        const sideLength = size * 0.3 * (1 - branchPosition);

        path.moveTo(branchX, branchY);
        path.lineTo(
          branchX + Math.cos(angle - Math.PI / 4) * sideLength,
          branchY + Math.sin(angle - Math.PI / 4) * sideLength,
        );
        path.moveTo(branchX, branchY);
        path.lineTo(
          branchX + Math.cos(angle + Math.PI / 4) * sideLength,
          branchY + Math.sin(angle + Math.PI / 4) * sideLength,
        );
      }
    }

    return path;
  };

  const randomSnowflakeColor = (): string => {
    const colors = config.snowflake.colors;
    if (!colors.length) return "#ffffff";
    return colors[Math.floor(random() * colors.length)] ?? "#ffffff";
  };

  const createDepth = (opticalClass: SnowOpticalClass): number => {
    if (opticalClass === "powder") return random() * 0.46;
    if (opticalClass === "foreground") return 0.78 + random() * 0.22;
    return 0.24 + random() * 0.62;
  };

  const createSnowflake = (
    width: number,
    height: number,
    opticalClass: SnowOpticalClass,
    startAbove: boolean = false,
  ): Snowflake => {
    const baseSize =
      random() * (config.snowflake.maxSize - config.snowflake.minSize) +
      config.snowflake.minSize;
    const depth = createDepth(opticalClass);
    const optical = createSnowOpticalFields(
      opticalClass,
      baseSize,
      { width, height },
      random,
    );
    const x =
      opticalClass === "foreground"
        ? getForegroundBirthX(width, random)
        : random() * width;

    return {
      x,
      y: startAbove ? -optical.opticalScale - random() * 24 : random() * height,
      speed:
        (random() * (config.snowflake.maxSpeed - config.snowflake.minSpeed) +
          config.snowflake.minSpeed) *
        (0.5 + depth * 0.5),
      size: baseSize * (0.4 + depth * 0.6),
      sway: (random() - 0.5) * (1 + depth),
      opacity: (random() * 0.6 + 0.3) * (0.6 + depth * 0.4),
      shape: generateSnowflakeShape(baseSize),
      color: randomSnowflakeColor(),
      rotation: random() * Math.PI * 2,
      rotationSpeed: (random() - 0.5) * 0.02,
      sparkle: random() > 0.7 ? random() : 0,
      sparklePhase: random() * Math.PI * 2,
      depth,
      windVelocityX: 0,
      windVelocityY: 0,
      ...optical,
    };
  };

  const getAdjustedDensity = (
    width: number,
    height: number,
    quality: QualityLevel | string,
  ): number => {
    let adjustedDensity = config.snowflake.density;
    const screenArea = width * height;
    const desktopArea = 1920 * 1080;
    adjustedDensity *= Math.min(1, Math.max(0.5, screenArea / desktopArea));
    if (width < 768) adjustedDensity *= 2.5;
    if (
      quality === "low" ||
      quality === "minimal" ||
      quality === "ultra-minimal"
    ) {
      adjustedDensity *= 0.5;
    } else if (quality === "medium") {
      adjustedDensity *= 0.75;
    }
    return adjustedDensity;
  };

  const getTargetCount = (
    dimensions: Dimensions,
    quality: QualityLevel | string,
  ): number =>
    Math.floor(
      dimensions.width *
        dimensions.height *
        getAdjustedDensity(dimensions.width, dimensions.height, quality),
    );

  const rebuildBandIndices = (flakes: readonly Snowflake[]): void => {
    bandIndices.powder.length = 0;
    bandIndices.crystal.length = 0;
    bandIndices.foreground.length = 0;
    flakes.forEach((flake, index) =>
      bandIndices[flake.opticalClass].push(index),
    );
  };

  const createPopulation = (
    dimensions: Dimensions,
    quality: QualityLevel,
    startAbove: boolean = false,
  ): Snowflake[] => {
    const total = getTargetCount(dimensions, quality);
    const targets = getSnowBandTargets(total, dimensions, quality);
    const flakes: Snowflake[] = [];
    for (const opticalClass of ["powder", "crystal", "foreground"] as const) {
      for (let index = 0; index < targets[opticalClass]; index += 1) {
        flakes.push(
          createSnowflake(
            dimensions.width,
            dimensions.height,
            opticalClass,
            startAbove,
          ),
        );
      }
    }
    flakes.sort((left, right) => left.depth - right.depth);
    rebuildBandIndices(flakes);
    return flakes;
  };

  const initialize = (
    dimensions: Dimensions,
    quality: QualityLevel,
  ): Snowflake[] => {
    windField.initialize();
    parallaxTracker.initialize();
    cursorLightTracker.initialize();
    currentDimensions = { ...dimensions };
    currentQuality = quality;
    qualityConverged = true;
    renderer.initialize(quality);
    return createPopulation(dimensions, quality);
  };

  const countBands = (flakes: readonly Snowflake[]): SnowBandTargets => {
    const counts: SnowBandTargets = { powder: 0, crystal: 0, foreground: 0 };
    for (const flake of flakes) counts[flake.opticalClass] += 1;
    return counts;
  };

  const selectAdditionClass = (
    counts: SnowBandTargets,
    targets: SnowBandTargets,
  ): SnowOpticalClass => {
    const deficits = (["powder", "crystal", "foreground"] as const).map(
      (opticalClass) => ({
        opticalClass,
        deficit: targets[opticalClass] - counts[opticalClass],
      }),
    );
    deficits.sort((left, right) => right.deficit - left.deficit);
    return deficits[0]?.deficit && deficits[0].deficit > 0
      ? deficits[0].opticalClass
      : "crystal";
  };

  const removeBalanced = (
    flakes: Snowflake[],
    removeCount: number,
    targets: SnowBandTargets,
  ): void => {
    for (let removed = 0; removed < removeCount; removed += 1) {
      const counts = countBands(flakes);
      const source = (["powder", "crystal", "foreground"] as const)
        .map((opticalClass) => ({
          opticalClass,
          surplus: counts[opticalClass] - targets[opticalClass],
        }))
        .sort((left, right) => right.surplus - left.surplus)[0]?.opticalClass;
      let index = -1;
      for (let candidate = flakes.length - 1; candidate >= 0; candidate -= 1) {
        if (flakes[candidate]?.opticalClass === (source ?? "crystal")) {
          index = candidate;
          break;
        }
      }
      flakes.splice(index >= 0 ? index : flakes.length - 1, 1);
    }
  };

  const reclassifyTowardTargets = (
    flakes: Snowflake[],
    targets: SnowBandTargets,
    changeLimit: number,
  ): boolean => {
    let changed = false;
    for (let change = 0; change < changeLimit; change += 1) {
      const counts = countBands(flakes);
      const destination = (["foreground", "powder", "crystal"] as const).find(
        (opticalClass) => counts[opticalClass] < targets[opticalClass],
      );
      if (!destination) break;
      const source = (["powder", "crystal", "foreground"] as const).find(
        (opticalClass) => counts[opticalClass] > targets[opticalClass],
      );
      if (!source) break;

      const candidates = flakes
        .map((flake, index) => ({ flake, index }))
        .filter(({ flake }) => flake.opticalClass === source)
        .sort((left, right) =>
          destination === "foreground"
            ? right.flake.depth - left.flake.depth
            : left.flake.depth - right.flake.depth,
        );
      const candidate = candidates[0];
      if (!candidate) break;
      Object.assign(
        candidate.flake,
        createSnowOpticalFields(
          destination,
          candidate.flake.size,
          currentDimensions,
          random,
        ),
        { opticalAlpha: destination === "foreground" ? 0 : 1 },
      );
      changed = true;
    }
    return changed;
  };

  const convergeQuality = (
    flakes: readonly Snowflake[],
    dimensions: Dimensions,
  ): Snowflake[] => {
    const finalTarget = getTargetCount(dimensions, currentQuality);
    if (qualityConverged && flakes.length === finalTarget)
      return flakes as Snowflake[];
    const changeLimit = Math.max(1, Math.ceil(finalTarget * 0.05));
    let next = flakes as Snowflake[];
    let structuralChange = false;

    if (flakes.length < finalTarget) {
      next = [...flakes];
      const additions = Math.min(changeLimit, finalTarget - flakes.length);
      const finalTargets = getSnowBandTargets(
        finalTarget,
        dimensions,
        currentQuality,
      );
      const counts = countBands(next);
      for (let index = 0; index < additions; index += 1) {
        const opticalClass = selectAdditionClass(counts, finalTargets);
        next.push(
          createSnowflake(
            dimensions.width,
            dimensions.height,
            opticalClass,
            true,
          ),
        );
        counts[opticalClass] += 1;
      }
      structuralChange = true;
    } else if (flakes.length > finalTarget) {
      next = [...flakes];
      const removals = Math.min(changeLimit, flakes.length - finalTarget);
      removeBalanced(
        next,
        removals,
        getSnowBandTargets(finalTarget, dimensions, currentQuality),
      );
      structuralChange = true;
    }

    const currentTargets = getSnowBandTargets(
      next.length,
      dimensions,
      currentQuality,
    );
    structuralChange =
      reclassifyTowardTargets(next, currentTargets, changeLimit) ||
      structuralChange;

    if (structuralChange) {
      next.sort((left, right) => left.depth - right.depth);
      rebuildBandIndices(next);
    }
    const counts = countBands(next);
    const targets = getSnowBandTargets(next.length, dimensions, currentQuality);
    qualityConverged =
      next.length === finalTarget &&
      counts.powder === targets.powder &&
      counts.crystal === targets.crystal &&
      counts.foreground === targets.foreground;
    return next;
  };

  const update = (
    flakes: Snowflake[],
    dimensions: Dimensions,
    frameMultiplier: number = 1,
  ): Snowflake[] => {
    currentDimensions = { ...dimensions };
    windField.update(frameMultiplier);
    parallaxTracker.update(frameMultiplier);
    cursorLightTracker.update(frameMultiplier);
    const activeFlakes = convergeQuality(flakes, dimensions);

    for (const flake of activeFlakes) {
      const wind = windField.sample(flake.x, flake.y, flake.depth, dimensions);
      const response = 1 - Math.pow(0.86, frameMultiplier);
      const windVelocityX =
        flake.windVelocityX + (wind.x - flake.windVelocityX) * response;
      const windVelocityY =
        flake.windVelocityY + (wind.y - flake.windVelocityY) * response;
      const microDrift =
        flake.sway * 0.12 +
        Math.sin(flake.y * 0.012 + flake.sparklePhase) * 0.08;
      const newX = flake.x + (windVelocityX + microDrift) * frameMultiplier;
      const newY =
        flake.y + Math.max(0.08, flake.speed + windVelocityY) * frameMultiplier;
      const windEnergy = Math.min(
        2.5,
        Math.hypot(windVelocityX, windVelocityY),
      );
      const rotation =
        flake.rotation +
        flake.rotationSpeed * (1 + windEnergy * 0.7) * frameMultiplier;
      const sparklePhase = flake.sparklePhase + 0.05 * frameMultiplier;
      const opticalTarget =
        reducedMotion && flake.opticalClass === "foreground" ? 0 : 1;
      const opticalStep = OPTICAL_FADE_PER_FRAME * frameMultiplier;
      const opticalAlpha =
        flake.opticalAlpha < opticalTarget
          ? Math.min(opticalTarget, flake.opticalAlpha + opticalStep)
          : Math.max(opticalTarget, flake.opticalAlpha - opticalStep);

      if (newY > dimensions.height) {
        flake.x =
          flake.opticalClass === "foreground"
            ? getForegroundBirthX(dimensions.width, random)
            : random() * dimensions.width;
        flake.y = -flake.opticalScale - random() * 20;
        flake.rotation = rotation;
        flake.sparklePhase = sparklePhase;
        flake.windVelocityX = 0;
        flake.windVelocityY = 0;
        flake.opticalAlpha = opticalAlpha;
        continue;
      }

      const buffer = Math.max(50, flake.opticalScale);
      if (newX > dimensions.width + buffer) {
        flake.x = -buffer + random() * 10;
        flake.rotation = rotation;
        flake.sparklePhase = sparklePhase;
        flake.opticalAlpha = opticalAlpha;
        continue;
      }
      if (newX < -buffer) {
        flake.x = dimensions.width + buffer - random() * 10;
        flake.rotation = rotation;
        flake.sparklePhase = sparklePhase;
        flake.opticalAlpha = opticalAlpha;
        continue;
      }

      flake.x = newX;
      flake.y = newY;
      flake.rotation = rotation;
      flake.sparklePhase = sparklePhase;
      flake.windVelocityX = windVelocityX;
      flake.windVelocityY = windVelocityY;
      flake.opticalAlpha = opticalAlpha;
    }

    return activeFlakes;
  };

  const draw = (
    flakes: Snowflake[],
    ctx: CanvasRenderingContext2D,
    dimensions: Dimensions,
  ): void => {
    renderer.draw(flakes, bandIndices, ctx, dimensions);
  };

  const takeEvenly = (
    flakes: readonly Snowflake[],
    target: number,
  ): Snowflake[] => {
    if (flakes.length <= target) return [...flakes];
    if (target <= 0) return [];
    return Array.from({ length: target }, (_, index) => {
      const sourceIndex = Math.floor((index * flakes.length) / target);
      return flakes[sourceIndex] as Snowflake;
    });
  };

  const adjustToResize = (
    flakes: Snowflake[],
    oldDimensions: Dimensions,
    newDimensions: Dimensions,
    quality: QualityLevel,
  ): Snowflake[] => {
    currentDimensions = { ...newDimensions };
    currentQuality = quality;
    qualityConverged = true;
    renderer.setQuality(quality);
    const widthScale =
      oldDimensions.width > 0 ? newDimensions.width / oldDimensions.width : 1;
    const heightScale =
      oldDimensions.height > 0
        ? newDimensions.height / oldDimensions.height
        : 1;
    const resized = flakes.map((flake) => ({
      ...flake,
      x: flake.x * widthScale,
      y: flake.y * heightScale,
    }));
    const targetTotal = getTargetCount(newDimensions, quality);
    const targets = getSnowBandTargets(targetTotal, newDimensions, quality);
    const next: Snowflake[] = [];

    for (const opticalClass of ["powder", "crystal", "foreground"] as const) {
      const existing = resized.filter(
        (flake) => flake.opticalClass === opticalClass,
      );
      next.push(...takeEvenly(existing, targets[opticalClass]));
      for (
        let index = existing.length;
        index < targets[opticalClass];
        index += 1
      ) {
        next.push(
          createSnowflake(
            newDimensions.width,
            newDimensions.height,
            opticalClass,
          ),
        );
      }
    }

    next.sort((left, right) => left.depth - right.depth);
    rebuildBandIndices(next);
    return next;
  };

  const setQuality = (quality: QualityLevel): void => {
    if (currentQuality === quality) return;
    currentQuality = quality;
    qualityConverged = false;
    renderer.setQuality(quality);
  };

  const setPointer = (
    x: number,
    y: number,
    active: boolean,
    pointerType?: string,
  ): void => {
    if (pointerType === "touch") {
      windField.setPointer(0, 0, false);
    } else {
      windField.setPointer(x, y, active);
    }
    parallaxTracker.setPointer(x, y, active, pointerType, currentDimensions);
    cursorLightTracker.setPointer(x, y, active, pointerType);
  };

  const setReducedMotion = (nextReducedMotion: boolean): void => {
    reducedMotion = nextReducedMotion;
    windField.setReducedMotion(nextReducedMotion);
    parallaxTracker.setReducedMotion(nextReducedMotion);
    cursorLightTracker.setReducedMotion(nextReducedMotion);
  };

  const triggerGust = (direction?: -1 | 1): void => {
    windField.triggerGust(direction);
  };

  const getVolumeStats = () => ({
    ...renderer.getStats(),
    powder: bandIndices.powder.length,
    crystal: bandIndices.crystal.length,
    foreground: bandIndices.foreground.length,
  });

  const cleanup = (): void => {
    windField.initialize();
    parallaxTracker.initialize();
    cursorLightTracker.initialize();
    renderer.cleanup();
    bandIndices.powder.length = 0;
    bandIndices.crystal.length = 0;
    bandIndices.foreground.length = 0;
  };

  return {
    initialize,
    update,
    draw,
    adjustToResize,
    setQuality,
    setPointer,
    setReducedMotion,
    triggerGust,
    getWindStats: () => windField.getStats(),
    getParallaxStats: () => parallaxTracker.getStats(),
    getCursorLightStats: () => cursorLightTracker.getStats(currentDimensions),
    getVolumeStats,
    getBandIndices: (): SnowBandIndices => bandIndices,
    cleanup,
  };
};
