import type {
  Dimensions,
  QualityLevel,
  AccessibilitySettings,
} from "../../../core/domain/types.js";
import type { IBackgroundSystem } from "../../../core/contracts/IBackgroundSystem.js";

export interface CelestialLayers {
  gradient: boolean;
  clouds: boolean;
  sunGlow: boolean;
  atmosphere: boolean;
  vignette: boolean;
}

interface PuffTemplate {
  cx: number;
  cy: number;
  rx: number;
  ry: number;
  bright: number;
  alpha: number;
  oct: number;
  disp: number;
}

interface CloudTypeConfig {
  puffs: PuffTemplate[];
  sizeRange: [number, number];
  aspectRange: [number, number];
  altitudeRange: [number, number];
  speedRange: [number, number];
  baseFreq: number;
  baseDisplacement: number;
  blur: number;
  alphaBoost: number;
  jitter: number;
}

type CloudType = "cumulus" | "cirrus" | "stratus";

interface CloudSprite {
  type: CloudType;
  puffs: PuffTemplate[];
  seedBase: number;
  width: number;
  height: number;
  x: number;
  y: number;
  speed: number;
  bobPhase: number;
  bobSpeed: number;
  canvas: OffscreenCanvas | HTMLCanvasElement | null;
  padding: number;
  svgW: number;
  svgH: number;
}

const CLOUD_CONFIGS: Record<CloudType, CloudTypeConfig> = {
  cumulus: {
    puffs: [
      {
        cx: 0.5,
        cy: 0.8,
        rx: 0.44,
        ry: 0.11,
        bright: 0.83,
        alpha: 0.7,
        oct: 4,
        disp: 1.0,
      },
      {
        cx: 0.26,
        cy: 0.56,
        rx: 0.24,
        ry: 0.21,
        bright: 0.88,
        alpha: 0.75,
        oct: 4,
        disp: 1.0,
      },
      {
        cx: 0.73,
        cy: 0.6,
        rx: 0.22,
        ry: 0.19,
        bright: 0.88,
        alpha: 0.75,
        oct: 4,
        disp: 1.0,
      },
      {
        cx: 0.5,
        cy: 0.46,
        rx: 0.28,
        ry: 0.24,
        bright: 0.93,
        alpha: 0.8,
        oct: 4,
        disp: 1.0,
      },
      {
        cx: 0.35,
        cy: 0.3,
        rx: 0.21,
        ry: 0.19,
        bright: 0.97,
        alpha: 0.85,
        oct: 4,
        disp: 0.9,
      },
      {
        cx: 0.65,
        cy: 0.33,
        rx: 0.19,
        ry: 0.17,
        bright: 0.97,
        alpha: 0.85,
        oct: 4,
        disp: 0.9,
      },
      {
        cx: 0.5,
        cy: 0.16,
        rx: 0.16,
        ry: 0.14,
        bright: 1.0,
        alpha: 0.9,
        oct: 3,
        disp: 0.8,
      },
      {
        cx: 0.12,
        cy: 0.55,
        rx: 0.1,
        ry: 0.09,
        bright: 0.92,
        alpha: 0.35,
        oct: 2,
        disp: 0.5,
      },
      {
        cx: 0.88,
        cy: 0.53,
        rx: 0.09,
        ry: 0.08,
        bright: 0.92,
        alpha: 0.35,
        oct: 2,
        disp: 0.5,
      },
      {
        cx: 0.2,
        cy: 0.36,
        rx: 0.09,
        ry: 0.08,
        bright: 0.95,
        alpha: 0.32,
        oct: 2,
        disp: 0.5,
      },
      {
        cx: 0.8,
        cy: 0.38,
        rx: 0.08,
        ry: 0.07,
        bright: 0.95,
        alpha: 0.32,
        oct: 2,
        disp: 0.5,
      },
      {
        cx: 0.5,
        cy: 0.05,
        rx: 0.09,
        ry: 0.07,
        bright: 1.0,
        alpha: 0.3,
        oct: 2,
        disp: 0.4,
      },
      {
        cx: 0.28,
        cy: 0.18,
        rx: 0.08,
        ry: 0.07,
        bright: 0.98,
        alpha: 0.3,
        oct: 2,
        disp: 0.4,
      },
      {
        cx: 0.72,
        cy: 0.22,
        rx: 0.09,
        ry: 0.07,
        bright: 0.98,
        alpha: 0.3,
        oct: 2,
        disp: 0.4,
      },
    ],
    sizeRange: [380, 640],
    aspectRange: [1.4, 2.0],
    altitudeRange: [0.32, 0.62],
    speedRange: [0.15, 0.4],
    baseFreq: 0.011,
    baseDisplacement: 100,
    blur: 2.0,
    alphaBoost: 1.8,
    jitter: 0.06,
  },
  cirrus: {
    puffs: [
      {
        cx: 0.5,
        cy: 0.5,
        rx: 0.44,
        ry: 0.12,
        bright: 0.96,
        alpha: 0.42,
        oct: 3,
        disp: 1.0,
      },
      {
        cx: 0.3,
        cy: 0.44,
        rx: 0.28,
        ry: 0.1,
        bright: 0.98,
        alpha: 0.36,
        oct: 3,
        disp: 0.8,
      },
      {
        cx: 0.7,
        cy: 0.55,
        rx: 0.26,
        ry: 0.09,
        bright: 0.94,
        alpha: 0.34,
        oct: 3,
        disp: 0.7,
      },
      {
        cx: 0.16,
        cy: 0.4,
        rx: 0.16,
        ry: 0.07,
        bright: 0.97,
        alpha: 0.25,
        oct: 2,
        disp: 0.5,
      },
      {
        cx: 0.84,
        cy: 0.6,
        rx: 0.14,
        ry: 0.06,
        bright: 0.95,
        alpha: 0.22,
        oct: 2,
        disp: 0.5,
      },
      {
        cx: 0.42,
        cy: 0.38,
        rx: 0.1,
        ry: 0.05,
        bright: 0.98,
        alpha: 0.18,
        oct: 2,
        disp: 0.4,
      },
    ],
    sizeRange: [250, 420],
    aspectRange: [3.0, 5.0],
    altitudeRange: [0.06, 0.22],
    speedRange: [0.5, 0.9],
    baseFreq: 0.02,
    baseDisplacement: 50,
    blur: 1.5,
    alphaBoost: 1.5,
    jitter: 0.04,
  },
  stratus: {
    puffs: [
      {
        cx: 0.5,
        cy: 0.55,
        rx: 0.48,
        ry: 0.17,
        bright: 0.87,
        alpha: 0.5,
        oct: 3,
        disp: 1.0,
      },
      {
        cx: 0.44,
        cy: 0.44,
        rx: 0.42,
        ry: 0.14,
        bright: 0.91,
        alpha: 0.45,
        oct: 3,
        disp: 0.8,
      },
      {
        cx: 0.56,
        cy: 0.5,
        rx: 0.38,
        ry: 0.12,
        bright: 0.94,
        alpha: 0.42,
        oct: 2,
        disp: 0.7,
      },
      {
        cx: 0.1,
        cy: 0.5,
        rx: 0.12,
        ry: 0.06,
        bright: 0.9,
        alpha: 0.25,
        oct: 2,
        disp: 0.4,
      },
      {
        cx: 0.9,
        cy: 0.48,
        rx: 0.11,
        ry: 0.05,
        bright: 0.9,
        alpha: 0.25,
        oct: 2,
        disp: 0.4,
      },
    ],
    sizeRange: [400, 700],
    aspectRange: [4.0, 6.5],
    altitudeRange: [0.28, 0.5],
    speedRange: [0.1, 0.25],
    baseFreq: 0.007,
    baseDisplacement: 80,
    blur: 2.5,
    alphaBoost: 1.6,
    jitter: 0.03,
  },
};

const SKY_TOP = "#2070c8";
const SKY_MID = "#4a9ae8";
const SKY_BOTTOM = "#8dc4e8";
const SKY_HORIZON = "#d4c8a0";

const WIND_SPEED = 0.08;
const VERTICAL_BOB = 0.18;
const WARMTH = 0.08;
const HAZE = 0.04;
const VIGNETTE = 0.08;

function mulberry32(a: number): () => number {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function rangeR(rng: () => number, lo: number, hi: number): number {
  return lo + rng() * (hi - lo);
}

function generateCloudData(
  type: CloudType,
  rng: () => number,
  globalSize: number,
): CloudSprite {
  const cfg = CLOUD_CONFIGS[type];
  const w = rangeR(rng, cfg.sizeRange[0], cfg.sizeRange[1]) * globalSize;
  const aspect = rangeR(rng, cfg.aspectRange[0], cfg.aspectRange[1]);
  const h = w / aspect;
  const seedBase = Math.floor(rng() * 100000);

  let puffs: PuffTemplate[] = cfg.puffs.map((p) => ({
    cx: p.cx + (rng() - 0.5) * cfg.jitter * 2,
    cy: p.cy + (rng() - 0.5) * cfg.jitter * 1.5,
    rx: p.rx * (0.82 + rng() * 0.36),
    ry: p.ry * (0.82 + rng() * 0.36),
    bright: p.bright,
    alpha: p.alpha,
    oct: p.oct,
    disp: p.disp,
  }));

  if (type === "cumulus") {
    const dropCount = Math.floor(rng() * 2.5);
    for (let d = 0; d < dropCount; d++) {
      const idx = 1 + Math.floor(rng() * (puffs.length - 1));
      puffs.splice(idx, 1);
    }
    const extraCount = 1 + Math.floor(rng() * 3);
    for (let j = 0; j < extraCount; j++) {
      puffs.push({
        cx: 0.15 + rng() * 0.7,
        cy: 0.12 + rng() * 0.55,
        rx: 0.08 + rng() * 0.15,
        ry: 0.06 + rng() * 0.13,
        bright: 0.9 + rng() * 0.1,
        alpha: 0.25 + rng() * 0.4,
        oct: 2 + Math.floor(rng() * 2),
        disp: 0.4 + rng() * 0.6,
      });
    }
    if (rng() > 0.5) {
      puffs.forEach((p) => {
        p.cx = 1 - p.cx;
      });
    }
    const xShift = (rng() - 0.5) * 0.1;
    puffs.forEach((p) => {
      p.cx = Math.max(0.02, Math.min(0.98, p.cx + xShift));
    });
  }

  if (type === "cirrus") {
    if (rng() > 0.5) {
      puffs.forEach((p) => {
        p.cy = 1 - p.cy;
      });
    }
    const thickMult = 0.7 + rng() * 0.8;
    puffs.forEach((p) => {
      p.ry *= thickMult;
    });
  }

  return {
    type,
    puffs,
    seedBase,
    width: Math.round(Math.max(60, w)),
    height: Math.round(Math.max(40, h)),
    x: rng() * 1.3 - 0.15,
    y: rangeR(rng, cfg.altitudeRange[0], cfg.altitudeRange[1]),
    speed: rangeR(rng, cfg.speedRange[0], cfg.speedRange[1]),
    bobPhase: rng() * Math.PI * 2,
    bobSpeed: 0.2 + rng() * 0.4,
    canvas: null,
    padding: 0,
    svgW: 0,
    svgH: 0,
  };
}

function buildCloudSVG(cloud: CloudSprite): {
  svg: string;
  padding: number;
  svgW: number;
  svgH: number;
} {
  const cfg = CLOUD_CONFIGS[cloud.type];
  const baseDisp = cfg.baseDisplacement;
  const blurVal = cfg.blur;
  const boostVal = cfg.alphaBoost;
  const freq = cfg.baseFreq;
  const { width: W, height: H, puffs, seedBase } = cloud;

  const padding = Math.round(Math.max(baseDisp * 1.5, 100));
  const svgW = W + padding * 2;
  const svgH = H + padding * 2;

  let defs = "";
  let shapes = "";

  puffs.forEach((p, i) => {
    const seed = seedBase + i * 17 + 1;
    const fId = `f${i}`;
    const gId = `g${i}`;
    const pDisp = Math.round(baseDisp * p.disp);

    defs +=
      `<filter id="${fId}" x="-80%" y="-80%" width="260%" height="260%" color-interpolation-filters="sRGB">` +
      `<feTurbulence type="fractalNoise" baseFrequency="${freq}" numOctaves="${p.oct}" seed="${seed}"/>` +
      `<feDisplacementMap in="SourceGraphic" scale="${pDisp}" xChannelSelector="R" yChannelSelector="G"/>` +
      `<feGaussianBlur stdDeviation="${blurVal.toFixed(1)}"/>` +
      `<feComponentTransfer><feFuncA type="linear" slope="${boostVal.toFixed(1)}" intercept="0"/></feComponentTransfer>` +
      `</filter>`;

    const bVal = Math.min(255, Math.round(p.bright * 255));
    const bB = Math.min(255, bVal + 3);
    const colStr = `rgb(${bVal},${bVal},${bB})`;

    defs +=
      `<radialGradient id="${gId}" cx="50%" cy="42%" r="58%" fx="50%" fy="42%">` +
      `<stop offset="0%" stop-color="${colStr}" stop-opacity="${p.alpha.toFixed(2)}"/>` +
      `<stop offset="30%" stop-color="${colStr}" stop-opacity="${(p.alpha * 0.85).toFixed(2)}"/>` +
      `<stop offset="55%" stop-color="${colStr}" stop-opacity="${(p.alpha * 0.55).toFixed(2)}"/>` +
      `<stop offset="78%" stop-color="${colStr}" stop-opacity="${(p.alpha * 0.22).toFixed(2)}"/>` +
      `<stop offset="100%" stop-color="${colStr}" stop-opacity="0"/>` +
      `</radialGradient>`;

    const cx = Math.round(p.cx * W) + padding;
    const cy = Math.round(p.cy * H) + padding;
    const rx = Math.round(p.rx * W);
    const ry = Math.round(p.ry * H);

    shapes += `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="url(#${gId})" filter="url(#${fId})"/>`;
  });

  return {
    svg:
      `<svg xmlns="http://www.w3.org/2000/svg" width="${svgW}" height="${svgH}">` +
      `<defs>${defs}</defs>${shapes}</svg>`,
    padding,
    svgW,
    svgH,
  };
}

function prerenderSVG(
  svgString: string,
  w: number,
  h: number,
): Promise<OffscreenCanvas | HTMLCanvasElement> {
  const blob = new Blob([svgString], {
    type: "image/svg+xml;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      let cvs: OffscreenCanvas | HTMLCanvasElement;
      let ctx:
        | CanvasRenderingContext2D
        | OffscreenCanvasRenderingContext2D
        | null;
      if (typeof OffscreenCanvas !== "undefined") {
        cvs = new OffscreenCanvas(w, h);
        ctx = cvs.getContext("2d");
      } else {
        cvs = document.createElement("canvas");
        cvs.width = w;
        cvs.height = h;
        ctx = cvs.getContext("2d");
      }
      ctx?.drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(url);
      resolve(cvs);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("SVG cloud render failed"));
    };
    img.src = url;
  });
}

export class CelestialBackgroundSystem implements IBackgroundSystem {
  private quality: QualityLevel = "medium";
  private isInitialized = false;
  private dimensions: Dimensions = { width: 0, height: 0 };
  private motionMultiplier = 1.0;
  private time = 0;

  private layers: CelestialLayers = {
    gradient: true,
    clouds: true,
    sunGlow: true,
    atmosphere: true,
    vignette: true,
  };

  private clouds: CloudSprite[] = [];
  private cloudsReady = false;
  private cloudGeneration = 0;

  public initialize(dimensions: Dimensions, quality: QualityLevel): void {
    this.quality = quality;
    this.dimensions = dimensions;
    this.time = 0;
    this.generateClouds(quality);
    this.isInitialized = true;
  }

  private generateClouds(quality: QualityLevel): void {
    const counts: Record<CloudType, number> =
      quality === "low"
        ? { cumulus: 2, cirrus: 2, stratus: 1 }
        : quality === "medium"
          ? { cumulus: 3, cirrus: 3, stratus: 1 }
          : { cumulus: 4, cirrus: 4, stratus: 1 };

    const globalSize =
      quality === "low" ? 0.8 : quality === "medium" ? 1.0 : 1.1;

    const rng = mulberry32(12345);
    const newClouds: CloudSprite[] = [];

    for (const [type, count] of Object.entries(counts) as [
      CloudType,
      number,
    ][]) {
      for (let i = 0; i < count; i++) {
        newClouds.push(generateCloudData(type, rng, globalSize));
      }
    }

    const generation = ++this.cloudGeneration;
    this.clouds = newClouds;
    this.cloudsReady = false;
    void this.prerenderAllClouds(newClouds, generation);
  }

  private async prerenderAllClouds(
    clouds: CloudSprite[],
    generation: number,
  ): Promise<void> {
    const results = await Promise.allSettled(
      clouds.map(async (cloud) => {
        const result = buildCloudSVG(cloud);
        cloud.canvas = await prerenderSVG(result.svg, result.svgW, result.svgH);
        cloud.padding = result.padding;
        cloud.svgW = result.svgW;
        cloud.svgH = result.svgH;
        return cloud;
      }),
    );

    if (generation !== this.cloudGeneration) return;

    const failures = results.filter(
      (result): result is PromiseRejectedResult => result.status === "rejected",
    );
    if (failures.length > 0) {
      console.error(
        `Celestial cloud rendering failed for ${failures.length} sprite${failures.length === 1 ? "" : "s"}.`,
        failures[0]?.reason,
      );
    }

    this.clouds = results
      .filter(
        (r): r is PromiseFulfilledResult<CloudSprite> =>
          r.status === "fulfilled",
      )
      .map((r) => r.value);

    this.cloudsReady = true;
  }

  public update(dimensions: Dimensions, frameMultiplier: number = 1.0): void {
    if (dimensions.width > 0 && dimensions.height > 0 && !this.isInitialized) {
      this.initialize(dimensions, this.quality);
    }
    if (!this.isInitialized) return;

    this.dimensions = dimensions;
    this.time += (frameMultiplier * this.motionMultiplier) / 60;
  }

  public draw(ctx: CanvasRenderingContext2D, dimensions: Dimensions): void {
    ctx.clearRect(0, 0, dimensions.width, dimensions.height);

    if (this.layers.gradient) {
      this.drawSky(ctx, dimensions);
    }

    if (this.layers.sunGlow) {
      this.drawSunGlow(ctx, dimensions);
    }

    if (this.layers.clouds && this.cloudsReady) {
      this.drawClouds(ctx, dimensions);
    }

    if (this.layers.atmosphere) {
      this.drawAtmosphere(ctx, dimensions);
    }

    if (this.layers.vignette) {
      this.drawVignette(ctx, dimensions);
    }
  }

  private drawSky(ctx: CanvasRenderingContext2D, dim: Dimensions): void {
    const g = ctx.createLinearGradient(0, 0, 0, dim.height);
    g.addColorStop(0, SKY_TOP);
    g.addColorStop(0.35, SKY_MID);
    g.addColorStop(0.7, SKY_BOTTOM);
    g.addColorStop(1, SKY_HORIZON);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, dim.width, dim.height);
  }

  private drawSunGlow(ctx: CanvasRenderingContext2D, dim: Dimensions): void {
    const sunX = dim.width * 0.78;
    const sunY = dim.height * 0.12;
    const sunR = Math.max(dim.width, dim.height) * 0.45;
    const sg = ctx.createRadialGradient(sunX, sunY, 0, sunX, sunY, sunR);
    sg.addColorStop(0, "rgba(255,248,220,0.22)");
    sg.addColorStop(0.2, "rgba(255,240,200,0.12)");
    sg.addColorStop(0.5, "rgba(255,230,180,0.04)");
    sg.addColorStop(1, "rgba(200,220,255,0)");
    ctx.fillStyle = sg;
    ctx.fillRect(0, 0, dim.width, dim.height);
  }

  private drawClouds(ctx: CanvasRenderingContext2D, dim: Dimensions): void {
    const sorted = [...this.clouds].sort((a, b) => a.y - b.y);

    for (const cloud of sorted) {
      if (!cloud.canvas) continue;

      const bobY =
        Math.sin(this.time * cloud.bobSpeed + cloud.bobPhase) *
        VERTICAL_BOB *
        6;

      let cx = cloud.x * dim.width + this.time * WIND_SPEED * cloud.speed * 30;
      const halfW = cloud.width / 2;
      const wrap = dim.width + cloud.svgW;
      cx = ((((cx + halfW) % wrap) + wrap) % wrap) - halfW;
      const cy = cloud.y * dim.height + bobY;

      const altFade = 1.0 - cloud.y * 0.3;
      const horizonFade = cloud.y > 0.55 ? 1.0 - (cloud.y - 0.55) * 1.5 : 1.0;
      const alpha = Math.max(0.15, Math.min(1, altFade * horizonFade));

      ctx.globalAlpha = alpha;
      ctx.drawImage(
        cloud.canvas as CanvasImageSource,
        cx - halfW - cloud.padding,
        cy - cloud.height / 2 - cloud.padding,
        cloud.svgW,
        cloud.svgH,
      );
      ctx.globalAlpha = 1;
    }
  }

  private drawAtmosphere(ctx: CanvasRenderingContext2D, dim: Dimensions): void {
    if (HAZE > 0) {
      const g = ctx.createLinearGradient(0, 0, 0, dim.height);
      g.addColorStop(0, `rgba(212,200,160,0)`);
      g.addColorStop(0.6, `rgba(212,200,160,${HAZE * 0.3})`);
      g.addColorStop(1, `rgba(212,200,160,${HAZE})`);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, dim.width, dim.height);
    }

    if (WARMTH > 0) {
      ctx.fillStyle = `rgba(180,130,60,${WARMTH * 0.12})`;
      ctx.fillRect(0, 0, dim.width, dim.height);
    }
  }

  private drawVignette(ctx: CanvasRenderingContext2D, dim: Dimensions): void {
    const cx = dim.width * 0.5;
    const cy = dim.height * 0.5;
    const r = Math.max(dim.width, dim.height) * 0.7;
    const g = ctx.createRadialGradient(cx, cy, r * 0.4, cx, cy, r);
    g.addColorStop(0, "rgba(0,0,0,0)");
    g.addColorStop(0.7, `rgba(0,0,0,${VIGNETTE * 0.3})`);
    g.addColorStop(1, `rgba(0,0,0,${VIGNETTE})`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, dim.width, dim.height);
  }

  public setQuality(quality: QualityLevel): void {
    if (this.quality !== quality) {
      this.quality = quality;
      if (this.isInitialized) {
        this.initialize(this.dimensions, quality);
      }
    }
  }

  public setAccessibility(settings: AccessibilitySettings): void {
    this.motionMultiplier = settings.reducedMotion ? 0.2 : 1.0;
  }

  public handleResize(_old: Dimensions, next: Dimensions): void {
    this.dimensions = next;
  }

  public cleanup(): void {
    this.cloudGeneration += 1;
    this.clouds = [];
    this.cloudsReady = false;
    this.isInitialized = false;
  }

  public setLayerVisibility(layers: Partial<CelestialLayers>): void {
    this.layers = { ...this.layers, ...layers };
  }

  public getLayerVisibility(): CelestialLayers {
    return { ...this.layers };
  }
}
