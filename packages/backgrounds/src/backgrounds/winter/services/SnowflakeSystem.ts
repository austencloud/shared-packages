import type { Dimensions } from "../../../core/domain/types.js";
import { WinterConfig } from "../../../core/domain/constants.js";
import type { Snowflake } from "../domain/models/winter-models.js";
import { WinterCursorLightTracker } from "./WinterCursorLightTracker.js";
import { WinterParallaxTracker } from "./WinterParallaxTracker.js";
import { WinterWindField } from "./WinterWindField.js";

export const createSnowflakeSystem = () => {
  const config = WinterConfig;
  const windField = new WinterWindField();
  const parallaxTracker = new WinterParallaxTracker();
  const cursorLightTracker = new WinterCursorLightTracker();
  let currentDimensions: Dimensions = { width: 1, height: 1 };

  const generateSnowflakeShape = (size: number): Path2D => {
    const path = new Path2D();
    const branches = 6; // Classic 6-pointed snowflake
    const complexity = Math.random() > 0.2 ? 2 : 1; // 80% chance of detailed snowflakes (was 50%)

    // Use consistent length for all branches of this snowflake (determined once per snowflake)
    const branchLength = size * (0.8 + Math.random() * 0.4);

    for (let i = 0; i < branches; i++) {
      const angle = (i * Math.PI * 2) / branches;

      // Main branch - all branches use the same length for perfect symmetry
      const endX = Math.cos(angle) * branchLength;
      const endY = Math.sin(angle) * branchLength;

      path.moveTo(0, 0);
      path.lineTo(endX, endY);

      // Add delicate side branches for more complex snowflakes
      if (complexity > 1) {
        for (let j = 1; j <= 2; j++) {
          const branchPos = j / 3;
          const branchX = Math.cos(angle) * branchLength * branchPos;
          const branchY = Math.sin(angle) * branchLength * branchPos;

          // Left side branch - consistent length for symmetry
          const leftAngle = angle - Math.PI / 4;
          const leftLength = size * 0.3 * (1 - branchPos);
          path.moveTo(branchX, branchY);
          path.lineTo(
            branchX + Math.cos(leftAngle) * leftLength,
            branchY + Math.sin(leftAngle) * leftLength,
          );

          // Right side branch - consistent length for symmetry
          const rightAngle = angle + Math.PI / 4;
          path.moveTo(branchX, branchY);
          path.lineTo(
            branchX + Math.cos(rightAngle) * leftLength,
            branchY + Math.sin(rightAngle) * leftLength,
          );
        }
      }
    }

    return path;
  };

  const randomSnowflakeColor = (): string => {
    const colors = config.snowflake.colors;
    if (!colors.length) return "#FFFFFF";
    return colors[Math.floor(Math.random() * colors.length)] ?? "#FFFFFF";
  };

  const createSnowflake = (width: number, height: number): Snowflake => {
    const size =
      Math.random() * (config.snowflake.maxSize - config.snowflake.minSize) +
      config.snowflake.minSize;
    const depth = Math.random(); // Depth for layering effects

    return {
      x: Math.random() * width,
      y: Math.random() * height,
      speed:
        (Math.random() *
          (config.snowflake.maxSpeed - config.snowflake.minSpeed) +
          config.snowflake.minSpeed) *
        (0.5 + depth * 0.5), // Vary speed by depth
      size: size * (0.4 + depth * 0.6), // Smaller flakes appear further away
      sway: (Math.random() * 1 - 0.5) * (1 + depth),
      opacity: (Math.random() * 0.6 + 0.3) * (0.6 + depth * 0.4),
      shape: generateSnowflakeShape(size),
      color: randomSnowflakeColor(),
      rotation: Math.random() * Math.PI * 2,
      rotationSpeed: (Math.random() - 0.5) * 0.02, // Gentle rotation
      sparkle: Math.random() > 0.7 ? Math.random() : 0, // Only some sparkle
      sparklePhase: Math.random() * Math.PI * 2,
      depth,
      windVelocityX: 0,
      windVelocityY: 0,
    };
  };

  const getAdjustedDensity = (
    width: number,
    height: number,
    quality: string,
  ): number => {
    let adjustedDensity = config.snowflake.density;
    const screenArea = width * height;
    const desktopArea = 1920 * 1080;

    // Preserve the spacious desktop composition without starving narrow
    // viewports of enough flakes to make the shared wind field readable.
    const screenSizeFactor = Math.min(
      1,
      Math.max(0.5, screenArea / desktopArea),
    );
    adjustedDensity *= screenSizeFactor;

    if (width < 768) adjustedDensity *= 2.5;

    if (quality === "low") {
      adjustedDensity *= 0.5;
    } else if (quality === "medium") {
      adjustedDensity *= 0.75;
    }

    return adjustedDensity;
  };

  const initialize = (
    { width, height }: Dimensions,
    quality: string,
  ): Snowflake[] => {
    windField.initialize();
    parallaxTracker.initialize();
    cursorLightTracker.initialize();
    currentDimensions = { width, height };
    const adjustedDensity = getAdjustedDensity(width, height, quality);
    const count = Math.floor(width * height * adjustedDensity);
    const flakes = Array.from({ length: count }, () =>
      createSnowflake(width, height),
    );

    // Pre-sort by depth at initialization (depth never changes)
    // This avoids sorting every frame in draw()
    flakes.sort((a, b) => a.depth - b.depth);

    return flakes;
  };

  const update = (
    flakes: Snowflake[],
    { width, height }: Dimensions,
    frameMultiplier: number = 1.0,
  ): Snowflake[] => {
    currentDimensions = { width, height };
    windField.update(frameMultiplier);
    parallaxTracker.update(frameMultiplier);
    cursorLightTracker.update(frameMultiplier);

    return flakes.map((flake) => {
      const wind = windField.sample(flake.x, flake.y, flake.depth, {
        width,
        height,
      });
      const response = 1 - Math.pow(0.86, frameMultiplier);
      const windVelocityX =
        flake.windVelocityX + (wind.x - flake.windVelocityX) * response;
      const windVelocityY =
        flake.windVelocityY + (wind.y - flake.windVelocityY) * response;

      // Individual drift is now only surface texture. The shared field owns
      // the visible motion, which lets neighboring flakes travel together.
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
      const newRotation =
        flake.rotation +
        flake.rotationSpeed * (1 + windEnergy * 0.7) * frameMultiplier;

      // Update sparkle animation
      const newSparklePhase = flake.sparklePhase + 0.05 * frameMultiplier;

      if (newY > height) {
        return {
          ...flake,
          y: Math.random() * -20 - 10,
          x: Math.random() * width,
          rotation: newRotation,
          sparklePhase: newSparklePhase,
          windVelocityX: 0,
          windVelocityY: 0,
        };
      }

      // Allow flakes to drift off-screen before recycling (buffer zone)
      const buffer = 50;
      if (newX > width + buffer) {
        // Drifted off right edge - reappear from left
        return {
          ...flake,
          x: -buffer + Math.random() * 10,
          rotation: newRotation,
          sparklePhase: newSparklePhase,
        };
      }
      if (newX < -buffer) {
        // Drifted off left edge - reappear from right
        return {
          ...flake,
          x: width + buffer - Math.random() * 10,
          rotation: newRotation,
          sparklePhase: newSparklePhase,
        };
      }

      return {
        ...flake,
        x: newX,
        y: newY,
        rotation: newRotation,
        sparklePhase: newSparklePhase,
        windVelocityX,
        windVelocityY,
      };
    });
  };

  const draw = (
    flakes: Snowflake[],
    ctx: CanvasRenderingContext2D,
    dimensions: Dimensions,
  ): void => {
    if (!ctx) return;

    // Flakes are pre-sorted by depth at initialization (depth never changes)
    // so we can iterate directly without sorting each frame
    flakes.forEach((flake) => {
      const parallax = parallaxTracker.getOffset(flake.depth, dimensions);
      const renderedX = flake.x + parallax.x;
      const renderedY = flake.y + parallax.y;
      const lightIntensity = cursorLightTracker.getIntensityAt(
        renderedX,
        renderedY,
        flake.depth,
        dimensions,
      );
      const facetResponse =
        0.82 + Math.abs(Math.cos(flake.rotation * 3)) * 0.18;
      const reflectedLight = lightIntensity * facetResponse;
      ctx.save();
      ctx.translate(renderedX, renderedY);
      ctx.rotate(flake.rotation);

      const depthFactor = 0.3 + flake.depth * 0.7;
      const baseAlpha = flake.opacity * depthFactor;
      ctx.globalAlpha = Math.min(
        1,
        baseAlpha + reflectedLight * (0.06 + flake.depth * 0.12),
      );

      ctx.strokeStyle = flake.color;
      ctx.lineWidth = 0.4 + depthFactor * 0.5;
      ctx.stroke(flake.shape);

      if (reflectedLight > 0.01) {
        // A second crisp stroke brightens only the snow. `shadowBlur` here
        // would run an offscreen blur for every lit flake and costs too much
        // at 4K, while a radial fill would expose the cursor as a flat circle.
        ctx.globalCompositeOperation = "lighter";
        ctx.globalAlpha = reflectedLight * (0.028 + flake.depth * 0.07);
        ctx.strokeStyle = "#dff5ff";
        ctx.lineWidth = 0.9 + flake.depth * 0.8;
        ctx.stroke(flake.shape);

        const glintPulse = Math.max(0, Math.sin(flake.sparklePhase)) ** 14;
        const glintStrength =
          reflectedLight *
          flake.sparkle *
          Math.pow(flake.depth, 1.6) *
          glintPulse;

        if (glintStrength > 0.08) {
          const rayLength = 1.4 + glintStrength * 4.6;
          const diagonalLength = rayLength * 0.42;
          ctx.globalAlpha = Math.min(0.42, glintStrength * 0.55);
          ctx.strokeStyle = "#f7fdff";
          ctx.lineWidth = 0.45 + flake.depth * 0.4;
          ctx.beginPath();
          ctx.moveTo(-rayLength, 0);
          ctx.lineTo(rayLength, 0);
          ctx.moveTo(0, -rayLength);
          ctx.lineTo(0, rayLength);
          ctx.moveTo(-diagonalLength, -diagonalLength);
          ctx.lineTo(diagonalLength, diagonalLength);
          ctx.moveTo(-diagonalLength, diagonalLength);
          ctx.lineTo(diagonalLength, -diagonalLength);
          ctx.stroke();
        }
      }

      ctx.restore();
    });
  };

  const adjustToResize = (
    flakes: Snowflake[],
    oldDimensions: Dimensions,
    newDimensions: Dimensions,
    quality: string,
  ): Snowflake[] => {
    currentDimensions = { ...newDimensions };
    const targetCount = Math.floor(
      newDimensions.width *
        newDimensions.height *
        getAdjustedDensity(newDimensions.width, newDimensions.height, quality),
    );

    const widthScale =
      oldDimensions.width > 0 ? newDimensions.width / oldDimensions.width : 1;
    const heightScale =
      oldDimensions.height > 0
        ? newDimensions.height / oldDimensions.height
        : 1;
    const resizedFlakes = flakes.map((flake) => ({
      ...flake,
      x: flake.x * widthScale,
      y: flake.y * heightScale,
    }));
    const currentCount = resizedFlakes.length;

    if (targetCount > currentCount) {
      return [
        ...resizedFlakes,
        ...Array.from({ length: targetCount - currentCount }, () =>
          createSnowflake(newDimensions.width, newDimensions.height),
        ),
      ].sort((a, b) => a.depth - b.depth);
    } else if (targetCount < currentCount) {
      return resizedFlakes.slice(0, targetCount);
    }

    return resizedFlakes;
  };

  const setQuality = (_quality: string): void => {
    // future: adjust density dynamically
  };

  const setPointer = (
    x: number,
    y: number,
    active: boolean,
    pointerType?: string,
  ): void => {
    windField.setPointer(x, y, active);
    parallaxTracker.setPointer(x, y, active, pointerType, currentDimensions);
    cursorLightTracker.setPointer(x, y, active, pointerType);
  };

  const setReducedMotion = (reducedMotion: boolean): void => {
    windField.setReducedMotion(reducedMotion);
    parallaxTracker.setReducedMotion(reducedMotion);
    cursorLightTracker.setReducedMotion(reducedMotion);
  };

  const triggerGust = (direction?: -1 | 1): void => {
    windField.triggerGust(direction);
  };

  const getWindStats = () => windField.getStats();
  const getParallaxStats = () => parallaxTracker.getStats();
  const getCursorLightStats = () =>
    cursorLightTracker.getStats(currentDimensions);

  const cleanup = (): void => {
    windField.initialize();
    parallaxTracker.initialize();
    cursorLightTracker.initialize();
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
    getWindStats,
    getParallaxStats,
    getCursorLightStats,
    cleanup,
  };
};
