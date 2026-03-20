import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import type { ViewMode } from '../types/floorplan';

@customElement('fp-toolbar')
export class FpToolbar extends LitElement {
  @property() viewMode: ViewMode = 'view';
  @property() currentMapName = '';

  static styles = css`
    :host {
      display: flex;
      align-items: center;
      padding: 0 8px 0 4px;
      height: 48px;
      background: var(--app-header-background-color, #1a1a2e);
      color: var(--app-header-text-color, #fff);
      flex-shrink: 0;
      gap: 4px;
    }
    h1 {
      flex: 1;
      margin: 0;
      font-size: 18px;
      font-weight: 400;
      padding-left: 8px;
    }
    .actions { display: flex; align-items: center; gap: 8px; }
    button {
      cursor: pointer;
      padding: 6px 16px;
      border: none;
      border-radius: 4px;
      background: var(--primary-color, #03a9f4);
      color: #fff;
      font-size: 13px;
    }
    button.icon-btn {
      background: none;
      color: var(--app-header-text-color, #fff);
      font-size: 18px;
      padding: 4px 8px;
      opacity: 0.7;
      line-height: 1;
    }
    button.icon-btn:hover { opacity: 1; }
    button.ha-menu { display: none; }
    @media (max-width: 640px) and (orientation: portrait) {
      button.ha-menu { display: inline-flex; }
    }

    /* Sélecteur de carte — visible uniquement sur mobile */
    .map-selector {
      display: none;
      align-items: center;
      gap: 4px;
      max-width: 130px;
      overflow: hidden;
    }
    .map-selector button {
      display: flex;
      align-items: center;
      gap: 4px;
      background: rgba(255,255,255,0.12);
      color: var(--app-header-text-color, #fff);
      padding: 4px 10px;
      font-size: 13px;
      border-radius: 20px;
      max-width: 130px;
      overflow: hidden;
    }
    .map-selector .map-name {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    @media (max-width: 640px) {
      h1 { display: none; }
      .map-selector { display: flex; flex: 1; }
      button:not(.icon-btn) { padding: 6px 10px; font-size: 12px; }
    }
  `;

  render() {
    return html`
      <button class="icon-btn ha-menu" title="Menu Home Assistant"
        @click=${(e: Event) => (e.target as HTMLElement).dispatchEvent(
          new CustomEvent('hass-toggle-menu', { bubbles: true, composed: true })
        )}>
        ☰
      </button>
      <h1>CartoForge</h1>
      <div class="map-selector">
        <button title="Changer de carte"
          @click=${() => this.dispatchEvent(new CustomEvent('map-list-toggle', { bubbles: true }))}>
          <span class="map-name">${this.currentMapName || 'Cartes'}</span>
          <span>▾</span>
        </button>
      </div>
      <div class="actions">
        <button class="icon-btn" title="Paramètres CartoForge"
          @click=${() => this.dispatchEvent(new CustomEvent('settings-open', { bubbles: true }))}>
          ⚙
        </button>
        <button @click=${() => this.dispatchEvent(new CustomEvent('mode-toggle', { bubbles: true }))}>
          ${this.viewMode === 'view' ? 'Mode édition' : 'Mode vue'}
        </button>
      </div>
    `;
  }
}
