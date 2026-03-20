import { LitElement, html, css, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import type { FloorMap } from '../types/floorplan';
import type { Hass } from '../utils/ha-api';
import { loadMaps } from '../utils/ha-api';

interface CartoForgeCardConfig {
  type: string;
  map_id?: string;
  map_ids?: string[];
  height?: number;
}

@customElement('carto-forge-card-editor')
export class CartoForgeCardEditor extends LitElement {
  @state() private _config?: CartoForgeCardConfig;
  @state() private _maps: FloorMap[] = [];
  @state() private _loading = true;

  private _hass?: Hass;

  set hass(h: Hass) {
    this._hass = h;
    if (this._maps.length === 0) this._loadMaps();
  }

  setConfig(config: CartoForgeCardConfig): void {
    this._config = { ...config };
  }

  private async _loadMaps(): Promise<void> {
    if (!this._hass) return;
    try {
      this._maps = await loadMaps(this._hass);
    } catch {
      this._maps = [];
    }
    this._loading = false;
  }

  private _selectedIds(): string[] {
    if (this._config?.map_ids?.length) return this._config.map_ids;
    if (this._config?.map_id) return [this._config.map_id];
    return [];
  }

  private _fireChanged(): void {
    this.dispatchEvent(
      new CustomEvent('config-changed', {
        detail: { config: this._config },
        bubbles: true,
        composed: true,
      })
    );
  }

  private _toggleMap(mapId: string): void {
    if (!this._config) return;
    const selected = this._selectedIds();
    const next = selected.includes(mapId)
      ? selected.filter((id) => id !== mapId)
      : [...selected, mapId];

    if (next.length === 1) {
      this._config = { ...this._config, map_id: next[0], map_ids: undefined };
    } else {
      this._config = { ...this._config, map_id: undefined, map_ids: next };
    }
    this._fireChanged();
  }

  private _heightChanged(e: Event): void {
    const val = parseInt((e.target as HTMLInputElement).value, 10);
    if (!this._config || isNaN(val)) return;
    this._config = { ...this._config, height: val };
    this._fireChanged();
  }

  static styles = css`
    :host {
      display: block;
      padding: 16px;
    }
    .section {
      margin-bottom: 16px;
    }
    label {
      display: block;
      font-weight: 500;
      margin-bottom: 8px;
      color: var(--primary-text-color);
    }
    .map-list {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .map-item {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 12px;
      border-radius: 8px;
      cursor: pointer;
      background: var(--secondary-background-color, #2a2a3e);
      transition: background 0.15s;
    }
    .map-item:hover {
      background: var(--primary-color, #03a9f4);
      color: #fff;
    }
    .map-item.selected {
      background: var(--primary-color, #03a9f4);
      color: #fff;
    }
    .map-item input[type="checkbox"] {
      pointer-events: none;
    }
    .height-input {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    input[type="range"] {
      flex: 1;
    }
    .height-val {
      min-width: 50px;
      text-align: right;
      color: var(--secondary-text-color);
    }
    .empty {
      color: var(--secondary-text-color);
      font-style: italic;
    }
  `;

  render() {
    if (!this._config) return nothing;

    const selected = this._selectedIds();
    const height = this._config.height ?? 400;

    return html`
      <div class="section">
        <label>Cartes à afficher</label>
        ${this._loading
          ? html`<div class="empty">Chargement…</div>`
          : this._maps.length === 0
            ? html`<div class="empty">Aucune carte trouvée. Créez-en une dans le panel CartoForge.</div>`
            : html`
              <div class="map-list">
                ${this._maps.map((m) => html`
                  <div
                    class="map-item ${selected.includes(m.id) ? 'selected' : ''}"
                    @click=${() => this._toggleMap(m.id)}
                  >
                    <input type="checkbox" .checked=${selected.includes(m.id)} />
                    <span>${m.name}</span>
                  </div>
                `)}
              </div>
            `}
      </div>

      <div class="section">
        <label>Hauteur</label>
        <div class="height-input">
          <input
            type="range"
            min="200"
            max="800"
            step="50"
            .value=${String(height)}
            @change=${this._heightChanged}
          />
          <span class="height-val">${height}px</span>
        </div>
      </div>
    `;
  }
}
