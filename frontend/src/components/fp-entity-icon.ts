import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import type { PlacedEntity, ViewMode, DrawTool } from '../types/floorplan';

// Long-press threshold before the options panel opens
const LONG_PRESS_MS = 600;
// Minimum movement in px before a press is considered a drag (not a long press)
const DRAG_THRESHOLD = 5;

@customElement('fp-entity-icon')
export class FpEntityIcon extends LitElement {
  @property({ attribute: false }) placement!: PlacedEntity;
  @property({ attribute: false }) entityState?: { state: string; attributes: Record<string, unknown> };
  @property() viewMode: ViewMode = 'view';
  @property() drawTool: DrawTool = 'select';

  private _pressTimer: ReturnType<typeof setTimeout> | null = null;
  // Prevents a click from firing after a long-press has already triggered (view mode)
  private _hasFired = false;
  // Stores initial press coords for edit-mode drag/long-press disambiguation
  private _pressStart: { x: number; y: number; pointerId: number } | null = null;

  static styles = css`
    :host {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 100%;
      height: 100%;
      cursor: pointer;
      user-select: none;
      -webkit-user-select: none;
      touch-action: none;
      transition: transform 0.1s;
    }
    :host([data-state="on"]) ha-icon  { color: #ffd700; }
    :host([data-state="off"]) ha-icon,
    :host(:not([data-state])) ha-icon { color: rgba(255, 255, 255, 0.8); }
    :host(:active) { transform: scale(0.85); }
    ha-icon { --mdc-icon-size: 22px; }

    @keyframes glow {
      0%, 100% { filter: drop-shadow(0 1px 4px rgba(0, 0, 0, 0.9)); }
      50%       { filter: drop-shadow(0 0 12px rgba(255, 215, 0, 0.9))
                           drop-shadow(0 0 4px rgba(255, 215, 0, 0.6)); }
    }
    :host([data-state="on"])  { animation: glow 2.5s ease-in-out infinite; }
    :host([data-state="off"]) { filter: drop-shadow(0 1px 4px rgba(0, 0, 0, 0.9)); }
  `;

  updated(): void {
    if (this.entityState) this.dataset['state'] = this.entityState.state;
    this.style.cursor = this.drawTool === 'eraser' ? 'cell' : 'pointer';
  }

  // -------------------------------------------------------------------------
  // Pointerdown — branche selon le mode au moment de l'appui
  // -------------------------------------------------------------------------
  private _onPointerDown = (e: PointerEvent): void => {
    if (this.viewMode === 'edit') {
      this._editDown(e);
    } else {
      this._viewDown();
    }
  };

  private _onPointerUp = (_e: PointerEvent): void => {
    if (this.viewMode === 'edit') {
      this._editUp();
    } else {
      this._viewUp();
    }
  };

  private _onPointerCancel = (): void => {
    if (this._pressTimer) { clearTimeout(this._pressTimer); this._pressTimer = null; }
    this.removeEventListener('pointermove', this._onEditPointerMove);
    this._pressStart = null;
    this._hasFired = false;
  };

  // -------------------------------------------------------------------------
  // Mode vue : clic court → toggle, long press → more-info natif HA
  // -------------------------------------------------------------------------
  private _viewDown(): void {
    this._hasFired = false;
    this._pressTimer = setTimeout(() => {
      this._hasFired = true;
      this.dispatchEvent(new CustomEvent('hass-more-info', {
        detail: { entityId: this.placement.entityId },
        bubbles: true,
        composed: true,
      }));
    }, LONG_PRESS_MS);
  }

  private _viewUp(): void {
    if (this._pressTimer) { clearTimeout(this._pressTimer); this._pressTimer = null; }
    if (!this._hasFired) this._emit('fp-click');
  }

  // -------------------------------------------------------------------------
  // Mode édition : distingue drag (mouvement > seuil) de long press (immobile)
  // -------------------------------------------------------------------------
  private _editDown(e: PointerEvent): void {
    if (this.drawTool === 'eraser') {
      this._emit('entity-remove');
      return;
    }
    this._pressStart = { x: e.clientX, y: e.clientY, pointerId: e.pointerId };
    this._pressTimer = setTimeout(() => {
      this._pressTimer = null;
      const start = this._pressStart;
      this._pressStart = null;
      this.removeEventListener('pointermove', this._onEditPointerMove);
      if (start) this._emit('fp-entity-config');
    }, LONG_PRESS_MS);
    this.addEventListener('pointermove', this._onEditPointerMove);
  }

  private _editUp(): void {
    if (this._pressTimer) { clearTimeout(this._pressTimer); this._pressTimer = null; }
    this.removeEventListener('pointermove', this._onEditPointerMove);
    this._pressStart = null;
  }

  private _onEditPointerMove = (e: PointerEvent): void => {
    if (!this._pressStart || !this._pressTimer) return;
    const dist = Math.hypot(e.clientX - this._pressStart.x, e.clientY - this._pressStart.y);
    if (dist > DRAG_THRESHOLD) {
      clearTimeout(this._pressTimer);
      this._pressTimer = null;
      this.removeEventListener('pointermove', this._onEditPointerMove);
      // Démarre le drag depuis les coords d'origine (évite un saut de position)
      const start = this._pressStart;
      this._pressStart = null;
      this._startDrag(e.pointerId, start.x, start.y);
    }
  };

  private _emit(type: string): void {
    this.dispatchEvent(new CustomEvent(type, {
      detail: { entityId: this.placement.entityId, placementId: this.placement.placementId },
      bubbles: true, composed: true,
    }));
  }

  // -------------------------------------------------------------------------
  // Drag : émet coords brutes, fp-map-viewer gère la conversion SVG
  // -------------------------------------------------------------------------
  private _startDrag(pointerId: number, clientX: number, clientY: number): void {
    // Capture keeps pointermove/pointerup firing even if the pointer leaves the element
    this.setPointerCapture(pointerId);
    this._dispatch('fp-drag-start', clientX, clientY);
    this.addEventListener('pointermove', this._onDrag);
    this.addEventListener('pointerup', this._stopDrag, { once: true });
  }

  private _onDrag = (e: PointerEvent): void => {
    this._dispatch('fp-drag-move', e.clientX, e.clientY);
  };

  private _stopDrag = (e: PointerEvent): void => {
    this.removeEventListener('pointermove', this._onDrag);
    this._dispatch('fp-drag-end', e.clientX, e.clientY);
  };

  private _dispatch(type: string, clientX: number, clientY: number): void {
    this.dispatchEvent(new CustomEvent(type, {
      detail: { placementId: this.placement.placementId, clientX, clientY },
      bubbles: true, composed: true,
    }));
  }

  connectedCallback(): void {
    super.connectedCallback();
    this.addEventListener('pointerdown', this._onPointerDown);
    this.addEventListener('pointerup', this._onPointerUp);
    this.addEventListener('pointercancel', this._onPointerCancel);
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this.removeEventListener('pointerdown', this._onPointerDown);
    this.removeEventListener('pointerup', this._onPointerUp);
    this.removeEventListener('pointercancel', this._onPointerCancel);
  }

  render() {
    return html`<ha-icon icon="${this.placement.icon ?? 'mdi:help-circle'}"></ha-icon>`;
  }
}
