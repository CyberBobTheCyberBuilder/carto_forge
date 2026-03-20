import { LitElement, html, css, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import type { FloorMap } from '../types/floorplan';
import './fp-map-settings-dialog';

@customElement('fp-map-list')
export class FpMapList extends LitElement {
  @property({ attribute: false }) maps: FloorMap[] = [];
  @property() activeMapId: string | null = null;

  @state() private _settingsMap: FloorMap | null = null;

  static styles = css`
    :host { display: block; padding: 8px 0; }
    .map-item {
      display: flex;
      align-items: center;
      padding: 10px 8px 10px 16px;
      border-left: 3px solid transparent;
      font-size: 14px;
    }
    .map-item:hover { background: var(--secondary-background-color, #f5f5f5); }
    .map-item.active {
      border-left-color: var(--primary-color, #03a9f4);
      font-weight: bold;
    }
    .map-name {
      flex: 1;
      cursor: pointer;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .map-actions {
      display: none;
      gap: 2px;
      flex-shrink: 0;
    }
    .map-item:hover .map-actions { display: flex; }
    .map-actions button {
      background: none;
      border: none;
      cursor: pointer;
      padding: 2px 5px;
      font-size: 13px;
      color: var(--secondary-text-color, #888);
      border-radius: 4px;
      line-height: 1;
    }
    .map-actions button:hover { background: var(--divider-color, #ddd); color: var(--primary-text-color, #333); }
    .map-actions button.delete:hover { color: #e53935; }
    @media (hover: none) {
      .map-actions { display: flex; }
    }
  `;

  private _openSettings(e: Event, m: FloorMap): void {
    e.stopPropagation();
    this._settingsMap = m;
  }

  private _delete(e: Event, m: FloorMap): void {
    e.stopPropagation();
    if (!confirm(`Supprimer la carte « ${m.name} » ? Cette action est irréversible.`)) return;
    this.dispatchEvent(new CustomEvent('map-delete', { detail: { mapId: m.id }, bubbles: true }));
  }

  private _onSettingsSave(e: CustomEvent): void {
    this._settingsMap = null;
    // Remonte l'événement tel quel vers carto-forge-panel
    this.dispatchEvent(new CustomEvent('map-settings-save', { detail: e.detail, bubbles: true }));
  }

  render() {
    return html`
      ${this.maps.map(
        (m) => html`
          <div class="map-item ${m.id === this.activeMapId ? 'active' : ''}">
            <span class="map-name"
              @click=${() => this.dispatchEvent(new CustomEvent('map-select', { detail: { mapId: m.id }, bubbles: true }))}
            >${m.name}</span>
            <div class="map-actions">
              <button title="Paramètres" @click=${(e: Event) => this._openSettings(e, m)}>⚙</button>
              <button class="delete" title="Supprimer" @click=${(e: Event) => this._delete(e, m)}>×</button>
            </div>
          </div>
        `
      )}

      ${this._settingsMap ? html`
        <fp-map-settings-dialog
          .map=${this._settingsMap}
          @save=${this._onSettingsSave}
          @map-delete=${(e: CustomEvent) => {
            this._settingsMap = null;
            this.dispatchEvent(new CustomEvent('map-delete', { detail: e.detail, bubbles: true }));
          }}
          @cancel=${() => { this._settingsMap = null; }}
        ></fp-map-settings-dialog>
      ` : nothing}
    `;
  }
}
