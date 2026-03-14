import { LitElement, html, css, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import type { FloorMap } from '../types/floorplan';
import type { Hass } from '../utils/ha-api';
import { loadMaps } from '../utils/ha-api';
import './fp-map-viewer';

interface CartoForgeCardConfig {
  type: string;
  map_id?: string;
  map_ids?: string[];
  height?: number;
}

@customElement('carto-forge-card')
export class CartoForgeCard extends LitElement {
  @state() private _maps: FloorMap[] = [];
  @state() private _activeMapId: string | null = null;
  @state() private _loading = false;
  @state() private _error: string | null = null;

  private _hass?: Hass;
  private _config?: CartoForgeCardConfig;
  private _loaded = false;

  // Lovelace appelle setConfig avant de passer hass
  setConfig(config: CartoForgeCardConfig): void {
    if (!config.map_id && !config.map_ids?.length) {
      throw new Error('carto-forge-card : map_id ou map_ids requis');
    }
    this._config = config;
  }

  // Lovelace injecte hass à chaque changement d'état — on ne charge les cartes qu'une fois
  set hass(h: Hass) {
    this._hass = h;
    if (!this._loaded && this._config) {
      this._loaded = true;
      this._load();
    }
    this.requestUpdate();
  }

  get hass(): Hass | undefined {
    return this._hass;
  }

  // Requis par Lovelace pour estimer la hauteur de la carte dans le dashboard
  getCardSize(): number {
    return Math.ceil((this._config?.height ?? 400) / 50);
  }

  private async _load(): Promise<void> {
    if (!this._hass) return;
    this._loading = true;
    try {
      const all = await loadMaps(this._hass);
      const ids = this._config?.map_id
        ? [this._config.map_id]
        : (this._config?.map_ids ?? []);
      this._maps = ids.length > 0 ? all.filter((m) => ids.includes(m.id)) : all;
      this._activeMapId = this._maps[0]?.id ?? null;
    } catch (e) {
      this._error = String(e);
    }
    this._loading = false;
  }

  static styles = css`
    :host {
      display: block;
      background: var(--ha-card-background, var(--card-background-color, #1e1e2e));
      border-radius: var(--ha-card-border-radius, 12px);
      overflow: hidden;
    }
    .tabs {
      display: flex;
      gap: 2px;
      padding: 8px 8px 0;
      background: var(--secondary-background-color, #111);
    }
    .tab {
      flex: 1;
      padding: 8px 12px;
      border: none;
      border-radius: 8px 8px 0 0;
      background: transparent;
      color: var(--secondary-text-color, #888);
      cursor: pointer;
      font-size: 13px;
      font-weight: 500;
      transition: background 0.15s, color 0.15s;
    }
    .tab.active {
      background: var(--primary-color, #03a9f4);
      color: #fff;
    }
    .viewer {
      width: 100%;
    }
    .state {
      display: flex;
      align-items: center;
      justify-content: center;
      height: 200px;
      color: var(--secondary-text-color, #888);
      font-size: 14px;
    }
    .error { color: var(--error-color, #f44336); }
  `;

  render() {
    if (!this._hass || !this._config) return nothing;

    if (this._loading) {
      return html`<div class="state">Chargement...</div>`;
    }
    if (this._error) {
      return html`<div class="state error">${this._error}</div>`;
    }
    if (!this._maps.length) {
      return html`<div class="state error">Aucune carte trouvée</div>`;
    }

    const map = this._maps.find((m) => m.id === this._activeMapId);
    const height = this._config.height ?? 400;
    const showTabs = this._maps.length > 1;

    return html`
      ${showTabs ? html`
        <div class="tabs">
          ${this._maps.map((m) => html`
            <button
              class="tab ${m.id === this._activeMapId ? 'active' : ''}"
              @click=${() => { this._activeMapId = m.id; }}
            >${m.name}</button>
          `)}
        </div>
      ` : nothing}

      <div class="viewer" style="height: ${height}px">
        ${map ? html`
          <fp-map-viewer
            .map=${map}
            .hass=${this._hass}
            viewMode="view"
            drawTool="select"
          ></fp-map-viewer>
        ` : html`<div class="state error">Carte introuvable</div>`}
      </div>
    `;
  }
}
