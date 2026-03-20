/**
 * background-card-element.ts - <background-card> Custom Element
 *
 * Interactive background selection card. Framework-agnostic.
 *
 * Attributes: type, label, gradient, accent-color, selected, disabled,
 *             tilt-degrees, glow-size
 *
 * Events: background-select ({ type: string })
 *
 * Slot: default — icon content (light DOM, inherits consumer CSS).
 *       Falls back to SVG from the registry when no slot content provided.
 *
 * Shadow DOM with open mode. Parts exposed for ::part() styling.
 */

import { BACKGROUND_CARD_STYLES } from "./background-card-styles.js";
import { getCardMetadata } from "../domain/background-card-constants.js";
import type { BackgroundCardSelectDetail } from "../domain/background-card-types.js";
import { attachTiltEffect } from "../effects/tilt-effect.js";
import type { TiltEffectHandle } from "../effects/tilt-effect.js";
import { attachCursorGlowEffect } from "../effects/cursor-glow-effect.js";
import type { CursorGlowEffectHandle } from "../effects/cursor-glow-effect.js";
import { createSpring } from "../effects/spring.js";
import type { Spring } from "../effects/spring.js";

const OBSERVED_ATTRS = [
  "type",
  "label",
  "gradient",
  "accent-color",
  "selected",
  "disabled",
  "tilt-degrees",
  "glow-size",
] as const;

export class BackgroundCardElement extends HTMLElement {
  static get observedAttributes(): readonly string[] {
    return OBSERVED_ATTRS;
  }

  // ── Shadow DOM refs ──────────────────────────────────
  private _shadow: ShadowRoot;
  private _fillEl!: HTMLDivElement;
  private _glowEl!: HTMLDivElement;
  private _iconEl!: HTMLDivElement;
  private _fallbackIcon!: HTMLSpanElement;
  private _nameEl!: HTMLSpanElement;
  private _ringEl!: HTMLDivElement;

  // ── Effect handles ───────────────────────────────────
  private _tiltHandle: TiltEffectHandle | null = null;
  private _glowHandle: CursorGlowEffectHandle | null = null;
  private _spring: Spring | null = null;

  constructor() {
    super();
    this._shadow = this.attachShadow({ mode: "open" });
  }

  // ── Lifecycle ────────────────────────────────────────

  connectedCallback(): void {
    this._buildDOM();
    this._applyAttributes();
    this._attachEffects();
    this._attachInteraction();

    // ARIA defaults
    if (!this.hasAttribute("role")) {
      this.setAttribute("role", "radio");
    }
    if (!this.hasAttribute("tabindex")) {
      this.setAttribute("tabindex", "0");
    }
    this._syncAriaChecked();
  }

  disconnectedCallback(): void {
    this._tiltHandle?.destroy();
    this._glowHandle?.destroy();
    this._spring?.destroy();
    this._tiltHandle = null;
    this._glowHandle = null;
    this._spring = null;
  }

  attributeChangedCallback(
    name: string,
    oldValue: string | null,
    newValue: string | null,
  ): void {
    if (oldValue === newValue) return;

    switch (name) {
      case "type":
        this._applyTypeDefaults();
        break;
      case "label":
        this._updateLabel();
        break;
      case "gradient":
        this._updateGradient();
        break;
      case "accent-color":
        this._updateAccent();
        break;
      case "selected":
        this._syncAriaChecked();
        break;
      case "disabled":
        this._syncDisabled();
        break;
      // tilt-degrees and glow-size only apply at connect time
    }
  }

  // ── DOM construction ─────────────────────────────────

  private _buildDOM(): void {
    const style = document.createElement("style");
    style.textContent = BACKGROUND_CARD_STYLES;

    this._fillEl = document.createElement("div");
    this._fillEl.className = "card-fill";
    this._fillEl.setAttribute("part", "fill");

    this._glowEl = document.createElement("div");
    this._glowEl.className = "glow-layer";
    this._glowEl.setAttribute("part", "glow");

    this._iconEl = document.createElement("div");
    this._iconEl.className = "card-icon";
    this._iconEl.setAttribute("part", "icon");

    const slot = document.createElement("slot");
    this._fallbackIcon = document.createElement("span");
    this._fallbackIcon.className = "fallback-icon";
    slot.appendChild(this._fallbackIcon);
    this._iconEl.appendChild(slot);

    const labelDiv = document.createElement("div");
    labelDiv.className = "card-label";
    labelDiv.setAttribute("part", "label");
    this._nameEl = document.createElement("span");
    this._nameEl.className = "card-name";
    labelDiv.appendChild(this._nameEl);

    this._ringEl = document.createElement("div");
    this._ringEl.className = "selection-ring";
    this._ringEl.setAttribute("part", "ring");

    this._shadow.append(style, this._fillEl, this._glowEl, this._iconEl, labelDiv, this._ringEl);
  }

  // ── Attribute application ────────────────────────────

  private _applyAttributes(): void {
    this._applyTypeDefaults();
    this._updateGradient();
    this._updateAccent();
    this._updateLabel();
    this._syncAriaChecked();
    this._syncDisabled();
  }

  /**
   * When `type` is set, pull defaults from the registry for any
   * attribute the consumer hasn't explicitly overridden.
   */
  private _applyTypeDefaults(): void {
    const type = this.getAttribute("type");
    if (!type) return;
    const meta = getCardMetadata(type);
    if (!meta) return;

    // Only set aria-label if consumer hasn't set one
    if (!this.hasAttribute("aria-label")) {
      this.setAttribute("aria-label", `${meta.label} background`);
    }

    this._updateGradient();
    this._updateAccent();
    this._updateLabel();
    this._updateFallbackIcon();
  }

  private _updateGradient(): void {
    const explicit = this.getAttribute("gradient");
    if (explicit) {
      this.style.setProperty("--card-gradient", explicit);
      return;
    }
    const meta = this._getMeta();
    if (meta) {
      this.style.setProperty("--card-gradient", meta.gradient);
    }
  }

  private _updateAccent(): void {
    const explicit = this.getAttribute("accent-color");
    if (explicit) {
      this.style.setProperty("--card-accent", explicit);
      return;
    }
    const meta = this._getMeta();
    if (meta) {
      this.style.setProperty("--card-accent", meta.accentColor);
    }
  }

  private _updateLabel(): void {
    if (!this._nameEl) return;
    const explicit = this.getAttribute("label");
    if (explicit) {
      this._nameEl.textContent = explicit;
      return;
    }
    const meta = this._getMeta();
    this._nameEl.textContent = meta?.label ?? "";
  }

  private _updateFallbackIcon(): void {
    if (!this._fallbackIcon) return;
    const meta = this._getMeta();
    this._fallbackIcon.innerHTML = meta?.iconSvg ?? "";
  }

  private _syncAriaChecked(): void {
    this.setAttribute("aria-checked", this.hasAttribute("selected") ? "true" : "false");
  }

  private _syncDisabled(): void {
    if (this.hasAttribute("disabled")) {
      this.setAttribute("tabindex", "-1");
    } else {
      this.setAttribute("tabindex", "0");
    }
  }

  private _getMeta() {
    const type = this.getAttribute("type");
    return type ? getCardMetadata(type) : undefined;
  }

  // ── Effects ──────────────────────────────────────────

  private _attachEffects(): void {
    const tiltDeg = parseFloat(this.getAttribute("tilt-degrees") ?? "4");
    this._tiltHandle = attachTiltEffect(this, {
      maxDegrees: isNaN(tiltDeg) ? 4 : tiltDeg,
      perspective: 800,
    });

    const glowSize = parseFloat(this.getAttribute("glow-size") ?? "120");
    this._glowHandle = attachCursorGlowEffect(this, {
      size: isNaN(glowSize) ? 120 : glowSize,
    });

    this._spring = createSpring(1, { stiffness: 300, damping: 15 });
    this._spring.onUpdate((value) => {
      this.style.setProperty("--card-scale", String(value));
    });
  }

  // ── Interaction ──────────────────────────────────────

  private _attachInteraction(): void {
    this.addEventListener("click", this._handleActivation);
    this.addEventListener("keydown", this._handleKeydown);
  }

  private _handleActivation = (): void => {
    if (this.hasAttribute("disabled")) return;

    // Spring pulse
    if (this._spring) {
      this._spring.target = 1.06;
      setTimeout(() => {
        if (this._spring) this._spring.target = 1;
      }, 150);
    }

    const type = this.getAttribute("type") ?? "";
    this.dispatchEvent(
      new CustomEvent<BackgroundCardSelectDetail>("background-select", {
        bubbles: true,
        composed: true,
        detail: { type },
      }),
    );
  };

  private _handleKeydown = (e: KeyboardEvent): void => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      this._handleActivation();
    }
  };
}

/**
 * Register the <background-card> custom element.
 * Safe to call multiple times — only registers once.
 * Call this in your app's entry point or top-level component.
 */
export function registerBackgroundCard(): void {
  if (!customElements.get("background-card")) {
    customElements.define("background-card", BackgroundCardElement);
  }
}
