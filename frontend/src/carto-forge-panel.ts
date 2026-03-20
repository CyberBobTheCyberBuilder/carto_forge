import { LitElement, html, css, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import './components/fp-toolbar';
import './components/fp-map-list';
import './components/fp-map-viewer';
import './components/fp-map-settings-dialog';
import './components/fp-settings-dialog';
import type { Hass } from './utils/ha-api';
import { loadMaps, fetchApi } from './utils/ha-api';
import { store } from './store';
import type { AppState } from './store';
import type { FloorMap, DrawTool } from './types/floorplan';
import { loadSettings, saveSettings, type CartoForgeSettings } from './types/settings';

@customElement('carto-forge-panel')
export class CartoForgePanel extends LitElement {
  @property({ attribute: false }) hass!: Hass;
  @property({ attribute: false }) panel!: { config: Record<string, unknown> };

  @state() private _app: AppState = store.getState();
  @state() private _showCreateDialog = false;
  @state() private _showSettingsDialog = false;
  @state() private _settings: CartoForgeSettings = loadSettings();
  @state() private _mapListOpen = false;

  private _unsub?: () => void;
  private _loaded = false;

  static styles = css`
    :host {
      display: flex;
      flex-direction: column;
      height: 100%;
      background: var(--primary-background-color, #1c1c1c);
      color: var(--primary-text-color, #e0e0e0);
    }
    .layout { display: flex; flex: 1; overflow: hidden; position: relative; }
    .sidebar {
      width: 220px;
      flex-shrink: 0;
      border-right: 1px solid var(--divider-color, #444);
      display: flex;
      flex-direction: column;
    }
    .sidebar-maps { flex: 1; overflow-y: auto; }
    .sidebar-footer {
      padding: 10px;
      border-top: 1px solid var(--divider-color, #444);
    }
    .overlay {
      display: none;
      position: absolute;
      inset: 0;
      background: rgba(0, 0, 0, 0.45);
      z-index: 29;
    }
    @media (max-width: 640px) {
      .sidebar {
        position: absolute;
        top: 0;
        left: 0;
        bottom: 0;
        z-index: 30;
        transform: translateX(-100%);
        transition: transform 0.22s ease;
        background: var(--primary-background-color, #1c1c1c);
      }
      .sidebar.open { transform: translateX(0); }
      .overlay.visible { display: block; }
    }
    .btn-add {
      width: 100%;
      padding: 8px;
      border: 1px dashed var(--divider-color, #555);
      border-radius: 6px;
      background: none;
      color: var(--primary-color, #03a9f4);
      cursor: pointer;
      font-size: 13px;
    }
    .btn-add:hover { background: var(--secondary-background-color, #2a2a2a); }
    fp-map-viewer { flex: 1; }
    .notice {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 16px;
      color: var(--secondary-text-color, #888);
    }
    .notice button {
      padding: 10px 24px;
      background: var(--primary-color, #03a9f4);
      color: #fff;
      border: none;
      border-radius: 8px;
      cursor: pointer;
      font-size: 14px;
    }
  `;

  connectedCallback(): void {
    super.connectedCallback();
    // Mirror store state into @state so Lit re-renders on every store change
    this._unsub = store.subscribe((s) => (this._app = s));
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this._unsub?.();
  }

  updated(changed: Map<string, unknown>): void {
    // Load maps only once, on the first hass assignment (HA sets it after mount)
    if (changed.has('hass') && this.hass && !this._loaded) {
      this._loaded = true;
      this._load();
    }
  }

  private async _load(): Promise<void> {
    store.update({ loading: true, error: null });
    try {
      const maps = await loadMaps(this.hass);
      store.setMaps(maps);
    } catch (e) {
      store.update({ error: String(e) });
    } finally {
      store.update({ loading: false });
    }
  }

  private async _createMap(e: CustomEvent<{ name: string; width: number; height: number; backgroundColor: string; backgroundImage: string | null }>): Promise<void> {
    this._showCreateDialog = false;
    const { name, width, height, backgroundColor, backgroundImage } = e.detail;
    const newMap: Omit<FloorMap, 'id'> = { name, width, height, backgroundColor, backgroundImage, drawing: [], entities: [] };
    try {
      const created = await fetchApi<FloorMap>(this.hass, '/carto_forge/maps', {
        method: 'POST',
        body: JSON.stringify(newMap),
      });
      store.setMaps([...this._app.maps, created]);
      store.setActiveMap(created.id);
    } catch (e) {
      store.update({ error: String(e) });
    }
  }

  private async _renameMap(e: CustomEvent<{ mapId: string; name: string }>): Promise<void> {
    const { mapId, name } = e.detail;
    const map = this._app.maps.find((m) => m.id === mapId);
    if (!map) return;
    const updated = { ...map, name };
    store.updateMap(updated);
    try {
      await fetchApi(this.hass, `/carto_forge/maps/${mapId}`, {
        method: 'PUT',
        body: JSON.stringify(updated),
      });
    } catch (err) {
      store.update({ error: String(err) });
    }
  }

  private async _saveMapSettings(e: CustomEvent<{ mapId: string; name: string; width: number; height: number; backgroundColor: string; backgroundImage?: string }>): Promise<void> {
    const { mapId, name, width, height, backgroundColor, backgroundImage } = e.detail;
    const map = this._app.maps.find((m) => m.id === mapId);
    if (!map) return;
    const updated = { ...map, name, width, height, backgroundColor, backgroundImage };
    store.updateMap(updated);
    try {
      await fetchApi(this.hass, `/carto_forge/maps/${mapId}`, {
        method: 'PUT',
        body: JSON.stringify(updated),
      });
    } catch (err) {
      store.update({ error: String(err) });
    }
  }

  private async _deleteMap(e: CustomEvent<{ mapId: string }>): Promise<void> {
    const { mapId } = e.detail;
    store.deleteMap(mapId);
    try {
      await fetchApi(this.hass, `/carto_forge/maps/${mapId}`, { method: 'DELETE' });
    } catch (err) {
      store.update({ error: String(err) });
    }
  }

  private _saveSettings(e: CustomEvent<CartoForgeSettings>): void {
    this._settings = e.detail;
    saveSettings(e.detail);
    this._showSettingsDialog = false;
  }

  private async _saveMap(e: CustomEvent<FloorMap>): Promise<void> {
    const map = e.detail;
    store.updateMap(map); // mise à jour locale immédiate
    try {
      await fetchApi(this.hass, `/carto_forge/maps/${map.id}`, {
        method: 'PUT',
        body: JSON.stringify(map),
      });
    } catch (err) {
      store.update({ error: String(err) });
    }
  }

  render() {
    const { maps, activeMapId, viewMode, drawTool, loading, error } = this._app;
    const activeMap = maps.find((m) => m.id === activeMapId);

    return html`
      <fp-toolbar
        .viewMode=${viewMode}
        .currentMapName=${activeMap?.name ?? ''}
        @mode-toggle=${() => store.setViewMode(viewMode === 'view' ? 'edit' : 'view')}
        @settings-open=${() => (this._showSettingsDialog = true)}
        @map-list-toggle=${() => (this._mapListOpen = !this._mapListOpen)}
      ></fp-toolbar>

      ${error ? html`<p style="color:red;padding:8px;margin:0">${error}</p>` : nothing}

      <div class="layout">
        <div class="overlay ${this._mapListOpen ? 'visible' : ''}"
          @click=${() => (this._mapListOpen = false)}></div>
        <div class="sidebar ${this._mapListOpen ? 'open' : ''}">
          <div class="sidebar-maps">
            <fp-map-list
              .maps=${maps}
              .activeMapId=${activeMapId}
              @map-select=${(e: CustomEvent<{ mapId: string }>) => { store.setActiveMap(e.detail.mapId); this._mapListOpen = false; }}
              @map-settings-save=${this._saveMapSettings}
              @map-delete=${this._deleteMap}
            ></fp-map-list>
          </div>
          <div class="sidebar-footer">
            <button class="btn-add" @click=${() => (this._showCreateDialog = true)}>
              + Nouvelle carte
            </button>
          </div>
        </div>

        ${loading
          ? html`<div class="notice"><span>Chargement…</span></div>`
          : activeMap
          ? html`
              <fp-map-viewer
                .map=${activeMap}
                .hass=${this.hass}
                .viewMode=${viewMode}
                .drawTool=${drawTool}
                .settings=${this._settings}
                @map-updated=${this._saveMap}
                @tool-change=${(e: CustomEvent<DrawTool>) => store.setDrawTool(e.detail)}
              ></fp-map-viewer>
            `
          : html`
              <div class="notice">
                <span>${maps.length === 0 ? 'Aucune carte pour l\'instant.' : 'Sélectionnez une carte.'}</span>
                ${maps.length === 0
                  ? html`<button @click=${() => (this._showCreateDialog = true)}>Créer ma première carte</button>`
                  : nothing}
              </div>
            `}
      </div>

      ${this._showCreateDialog ? html`
        <fp-map-settings-dialog
          mode="create"
          @create=${this._createMap}
          @cancel=${() => (this._showCreateDialog = false)}
        ></fp-map-settings-dialog>
      ` : nothing}

      ${this._showSettingsDialog ? html`
        <fp-settings-dialog
          .settings=${this._settings}
          @settings-save=${this._saveSettings}
          @cancel=${() => (this._showSettingsDialog = false)}
        ></fp-settings-dialog>
      ` : nothing}
    `;
  }
}
