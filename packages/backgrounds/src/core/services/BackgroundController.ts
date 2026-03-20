/**
 * BackgroundController - Singleton controller for canvas background rendering
 *
 * This controller manages all canvas-based background rendering outside of
 * Svelte's reactive system. It survives HMR via import.meta.hot.data persistence.
 */

import type {
  IBackgroundController,
  BackgroundOptions
} from "../contracts/IBackgroundController.js";
import type { BackgroundSystem } from "../domain/models.js";
import { BackgroundType } from "../domain/enums.js";
import type { QualityLevel } from "../domain/types.js";
import { BackgroundFactory } from "./BackgroundFactory.js";

/**
 * BackgroundController implementation
 */
export class BackgroundController implements IBackgroundController {
  // Canvas elements (owned by controller, created in mount())
  private canvasA: HTMLCanvasElement | null = null;
  private canvasB: HTMLCanvasElement | null = null;
  private container: HTMLElement | null = null;

  // Background system instances
  private systemA: BackgroundSystem | null = null;
  private systemB: BackgroundSystem | null = null;

  // Animation frame IDs
  private animationIdA: number | null = null;
  private animationIdB: number | null = null;

  // Which canvas is currently active (visible)
  private activeCanvas: 'A' | 'B' = 'A';

  // Current state
  private currentType: BackgroundType | null = null;
  private currentOptions: BackgroundOptions = {};
  private quality: QualityLevel = 'medium';

  // Transition state
  private isTransitioning = false;
  private pendingType: BackgroundType | null = null;
  private pendingOptions: BackgroundOptions | null = null;

  // Lifecycle flags
  private mounted = false;
  private initialized = false;
  private initializationInProgress = false;

  // Resize observer
  private resizeObserver: ResizeObserver | null = null;

  /**
   * Mount the controller to a container element.
   * Creates canvas elements and sets up observers.
   */
  mount(container: HTMLElement): void {
    // If already mounted to this exact container, just verify canvases
    if (this.mounted && this.container === container) {
      this.verifyCanvases();
      return;
    }

    // If mounted to a different container, unmount first
    if (this.mounted && this.container !== container) {
      this.unmount();
    }

    this.container = container;
    this.createCanvases();
    this.setupResizeObserver();
    this.mounted = true;

    // If we have a stored background type, initialize it
    if (this.currentType) {
      void this.initializeBackground(this.currentType, this.currentOptions);
    }
  }

  /**
   * Unmount the controller.
   * Stops animations, cleans up systems, removes canvases.
   */
  unmount(): void {
    // Stop all animations
    this.stopAnimation('A');
    this.stopAnimation('B');

    // Cleanup background systems
    this.systemA?.cleanup();
    this.systemB?.cleanup();
    this.systemA = null;
    this.systemB = null;

    // Disconnect resize observer
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;

    // Remove canvases from DOM
    this.canvasA?.remove();
    this.canvasB?.remove();
    this.canvasA = null;
    this.canvasB = null;

    // Clear container reference
    this.container = null;

    // Reset flags (but keep currentType for potential remount)
    this.mounted = false;
    this.initialized = false;
  }

  /**
   * Set the background type.
   */
  async setBackground(type: BackgroundType, options?: BackgroundOptions): Promise<void> {
    // Merge options with existing (allows partial updates)
    if (options) {
      this.currentOptions = { ...this.currentOptions, ...options };
    }

    // If not mounted yet, just store for later
    if (!this.mounted) {
      this.currentType = type;
      return;
    }

    // If same type, already initialized, and canvas has content → no-op
    if (
      this.currentType === type &&
      this.initialized &&
      !this.isActiveCanvasBlank()
    ) {
      return;
    }

    // If currently transitioning, queue this request
    if (this.isTransitioning) {
      this.pendingType = type;
      this.pendingOptions = options || null;
      return;
    }

    // First initialization or recovery from blank canvas
    if (!this.initialized || this.isActiveCanvasBlank()) {
      // Prevent concurrent initialization calls
      if (this.initializationInProgress) {
        this.pendingType = type;
        this.pendingOptions = options || null;
        return;
      }
      await this.initializeBackground(type, this.currentOptions);
      return;
    }

    // Type changed - perform crossfade
    await this.performCrossfade(type, this.currentOptions);
  }

  /**
   * Set quality level.
   */
  setQuality(quality: QualityLevel): void {
    this.quality = quality;
    this.systemA?.setQuality(quality);
    this.systemB?.setQuality(quality);
  }

  /**
   * Get current background type.
   */
  getCurrentType(): BackgroundType | null {
    return this.currentType;
  }

  /**
   * Check if ready.
   */
  isReady(): boolean {
    return this.mounted && this.initialized && !this.isActiveCanvasBlank();
  }

  /**
   * Force a refresh.
   */
  forceRefresh(): void {
    if (this.currentType && this.mounted) {
      this.initialized = false;
      void this.initializeBackground(this.currentType, this.currentOptions);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PRIVATE METHODS - Canvas Management
  // ═══════════════════════════════════════════════════════════════════════════

  private createCanvases(): void {
    if (!this.container) return;

    // Create canvas A
    this.canvasA = document.createElement('canvas');
    this.canvasA.className = 'background-canvas canvas-a';
    this.canvasA.setAttribute('aria-hidden', 'true');

    // Create canvas B
    this.canvasB = document.createElement('canvas');
    this.canvasB.className = 'background-canvas canvas-b';
    this.canvasB.setAttribute('aria-hidden', 'true');

    // Set initial active state
    this.updateActiveCanvasClass();

    // Append to container
    this.container.appendChild(this.canvasA);
    this.container.appendChild(this.canvasB);

    // Set initial dimensions
    this.updateCanvasDimensions();
  }

  private verifyCanvases(): void {
    if (!this.container) return;

    const aInDom = this.canvasA?.parentElement === this.container;
    const bInDom = this.canvasB?.parentElement === this.container;

    if (!aInDom || !bInDom) {
      // Canvases were removed (HMR?), recreate them
      this.canvasA?.remove();
      this.canvasB?.remove();
      this.createCanvases();

      // Re-initialize if we had a background
      if (this.currentType) {
        this.initialized = false;
        void this.initializeBackground(this.currentType, this.currentOptions);
      }
    }
  }

  private setupResizeObserver(): void {
    if (!this.container || typeof ResizeObserver === 'undefined') return;

    this.resizeObserver = new ResizeObserver(() => {
      this.handleResize();
    });
    this.resizeObserver.observe(this.container);
  }

  private updateCanvasDimensions(): void {
    if (!this.canvasA || !this.canvasB || !this.container) return;

    const rect = this.container.getBoundingClientRect();
    const width = Math.max(1, Math.floor(rect.width));
    const height = Math.max(1, Math.floor(rect.height));

    this.canvasA.width = width;
    this.canvasA.height = height;
    this.canvasB.width = width;
    this.canvasB.height = height;
  }

  private handleResize(): void {
    const oldWidth = this.canvasA?.width || 0;
    const oldHeight = this.canvasA?.height || 0;

    this.updateCanvasDimensions();

    const newWidth = this.canvasA?.width || 0;
    const newHeight = this.canvasA?.height || 0;

    // Only notify systems if dimensions actually changed
    if (oldWidth !== newWidth || oldHeight !== newHeight) {
      const oldDim = { width: oldWidth, height: oldHeight };
      const newDim = { width: newWidth, height: newHeight };
      this.systemA?.handleResize?.(oldDim, newDim);
      this.systemB?.handleResize?.(oldDim, newDim);
    }
  }

  private updateActiveCanvasClass(): void {
    if (this.canvasA) {
      this.canvasA.classList.toggle('active', this.activeCanvas === 'A');
    }
    if (this.canvasB) {
      this.canvasB.classList.toggle('active', this.activeCanvas === 'B');
    }
  }

  private isActiveCanvasBlank(): boolean {
    const canvas = this.activeCanvas === 'A' ? this.canvasA : this.canvasB;
    if (!canvas) return true;

    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return true;

    try {
      const pixel = ctx.getImageData(0, 0, 1, 1).data;
      return pixel[3] === 0;
    } catch {
      return true;
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PRIVATE METHODS - Background Initialization & Transitions
  // ═══════════════════════════════════════════════════════════════════════════

  private async initializeBackground(
    type: BackgroundType,
    options: BackgroundOptions
  ): Promise<void> {
    if (!this.canvasA) {
      return;
    }

    this.initializationInProgress = true;

    try {
      // Clean up any existing systems
      this.stopAnimation('A');
      this.stopAnimation('B');
      this.systemA?.cleanup();
      this.systemB?.cleanup();
      this.systemA = null;
      this.systemB = null;

      // Create the background system
      let system;
      try {
        system = await BackgroundFactory.createBackgroundSystem({
          type,
          quality: this.quality,
          initialQuality: this.quality,
          thumbnailMode: options.thumbnailMode,
          backgroundColor: options.backgroundColor,
          gradientColors: options.gradientColors,
          gradientDirection: options.gradientDirection
        });
      } catch (factoryError) {
        this.initializationInProgress = false;
        return;
      }

      if (!system) {
        this.initializationInProgress = false;
        return;
      }

      // Store and activate on canvas A
      this.systemA = system;
      this.activeCanvas = 'A';
      this.updateActiveCanvasClass();

      // Initialize the system with current dimensions
      const dimensions = {
        width: this.canvasA.width,
        height: this.canvasA.height
      };
      system.initialize(dimensions, this.quality);

      // Start the animation loop
      this.startAnimation('A', type);

      // Update state
      this.currentType = type;
      this.initialized = true;
    } finally {
      this.initializationInProgress = false;
    }

    // Process any pending request
    if (this.pendingType && this.pendingType !== type) {
      const pending = this.pendingType;
      const pendingOpts = this.pendingOptions || options;
      this.pendingType = null;
      this.pendingOptions = null;
      await this.performCrossfade(pending, pendingOpts);
    } else {
      this.pendingType = null;
      this.pendingOptions = null;
    }
  }

  private async performCrossfade(
    newType: BackgroundType,
    options: BackgroundOptions
  ): Promise<void> {
    this.isTransitioning = true;

    const incomingCanvas = this.activeCanvas === 'A' ? 'B' : 'A';
    const canvas = incomingCanvas === 'A' ? this.canvasA : this.canvasB;

    if (!canvas) {
      this.isTransitioning = false;
      return;
    }

    // Create the new background system
    const newSystem = await BackgroundFactory.createBackgroundSystem({
      type: newType,
      quality: this.quality,
      initialQuality: this.quality,
      thumbnailMode: options.thumbnailMode,
      backgroundColor: options.backgroundColor,
      gradientColors: options.gradientColors,
      gradientDirection: options.gradientDirection
    });

    // Store the new system
    if (incomingCanvas === 'A') {
      this.systemA = newSystem;
    } else {
      this.systemB = newSystem;
    }

    // Initialize with current dimensions
    const dimensions = { width: canvas.width, height: canvas.height };
    newSystem.initialize(dimensions, this.quality);

    // Start animation on the new canvas
    this.startAnimation(incomingCanvas, newType);

    // Wait for at least one frame to render
    await this.waitForFrame();
    await this.waitForFrame();

    // Trigger the CSS crossfade
    this.activeCanvas = incomingCanvas;
    this.updateActiveCanvasClass();

    // Wait for CSS transition (500ms)
    await this.delay(500);

    // Cleanup the old system
    const oldCanvas = incomingCanvas === 'A' ? 'B' : 'A';
    this.stopAnimation(oldCanvas);

    const oldSystem = oldCanvas === 'A' ? this.systemA : this.systemB;
    oldSystem?.cleanup();

    if (oldCanvas === 'A') {
      this.systemA = null;
    } else {
      this.systemB = null;
    }

    // Update state
    this.currentType = newType;
    this.isTransitioning = false;

    // Process any pending request
    if (this.pendingType && this.pendingType !== newType) {
      const pending = this.pendingType;
      const pendingOpts = this.pendingOptions || options;
      this.pendingType = null;
      this.pendingOptions = null;
      await this.performCrossfade(pending, pendingOpts);
    } else {
      this.pendingType = null;
      this.pendingOptions = null;
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PRIVATE METHODS - Animation Loop
  // ═══════════════════════════════════════════════════════════════════════════

  private startAnimation(which: 'A' | 'B', type: BackgroundType): void {
    const canvas = which === 'A' ? this.canvasA : this.canvasB;
    const system = which === 'A' ? this.systemA : this.systemB;

    if (!canvas || !system) return;

    const ctx = canvas.getContext('2d', { willReadFrequently: false });
    if (!ctx) return;

    // Check if this is a static background (no animation needed)
    const isStatic =
      type === BackgroundType.SOLID_COLOR ||
      type === BackgroundType.LINEAR_GRADIENT;

    if (isStatic) {
      // Render once and exit
      const dimensions = { width: canvas.width, height: canvas.height };
      system.draw(ctx, dimensions);
      return;
    }

    // Animated background - start the loop
    let lastTimestamp = 0;
    const MAX_DELTA_MS = 100;

    const animate = (timestamp: number): void => {
      const currentSystem = which === 'A' ? this.systemA : this.systemB;
      if (!currentSystem || !canvas) return;

      const rawDelta = lastTimestamp === 0 ? 16.67 : timestamp - lastTimestamp;
      lastTimestamp = timestamp;

      const deltaTime = Math.min(rawDelta, MAX_DELTA_MS);
      const frameMultiplier = deltaTime / 16.67;

      const dimensions = { width: canvas.width, height: canvas.height };

      currentSystem.update(dimensions, frameMultiplier);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      currentSystem.draw(ctx, dimensions);

      if (which === 'A') {
        this.animationIdA = requestAnimationFrame(animate);
      } else {
        this.animationIdB = requestAnimationFrame(animate);
      }
    };

    if (which === 'A') {
      this.animationIdA = requestAnimationFrame(animate);
    } else {
      this.animationIdB = requestAnimationFrame(animate);
    }
  }

  private stopAnimation(which: 'A' | 'B'): void {
    if (which === 'A' && this.animationIdA !== null) {
      cancelAnimationFrame(this.animationIdA);
      this.animationIdA = null;
    } else if (which === 'B' && this.animationIdB !== null) {
      cancelAnimationFrame(this.animationIdB);
      this.animationIdB = null;
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PRIVATE METHODS - Utilities
  // ═══════════════════════════════════════════════════════════════════════════

  private waitForFrame(): Promise<void> {
    return new Promise((resolve) => requestAnimationFrame(() => resolve()));
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// SINGLETON INSTANCE - Persists across HMR via import.meta.hot.data
// ═══════════════════════════════════════════════════════════════════════════════

let controllerInstance: BackgroundController | null = null;

// Restore from HMR data if available
declare const __HOT_DATA__: { backgroundController?: BackgroundController } | undefined;

// Check for Vite HMR
if (typeof import.meta !== "undefined" && (import.meta as unknown as { hot?: { data?: { backgroundController?: BackgroundController } } }).hot?.data?.backgroundController) {
  controllerInstance = (import.meta as unknown as { hot: { data: { backgroundController: BackgroundController } } }).hot.data.backgroundController;
}

/**
 * Get the singleton BackgroundController instance.
 *
 * The instance persists across HMR module reloads via import.meta.hot.data.
 * This ensures the canvas state survives code changes during development.
 */
export function getBackgroundController(): BackgroundController {
  if (!controllerInstance) {
    controllerInstance = new BackgroundController();
  }

  // Store in HMR data for persistence across module reloads
  if (typeof import.meta !== "undefined" && (import.meta as unknown as { hot?: { data?: Record<string, unknown> } }).hot) {
    (import.meta as unknown as { hot: { data: Record<string, unknown> } }).hot.data.backgroundController = controllerInstance;
  }

  return controllerInstance;
}
