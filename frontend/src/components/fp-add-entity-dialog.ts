import { LitElement, html, css } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import type { Hass } from '../utils/ha-api';

const DOMAIN_ICONS: Record<string, string> = {
  light: '💡', switch: '🔌', sensor: '🌡️', binary_sensor: '👁️',
  media_player: '📺', climate: '🌡️', cover: '🪟', camera: '📷',
  input_boolean: '🔘', script: '📜', automation: '⚡', scene: '🎭',
};

@customElement('fp-add-entity-dialog')
export class FpAddEntityDialog extends LitElement {
  @property({ attribute: false }) hass!: Hass;

  @state() private _query = '';

  static styles = css`
    .overlay {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.6);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 200;
    }
    .dialog {
      background: var(--card-background-color, #2d2d2d);
      border-radius: 14px;
      padding: 24px;
      width: 480px;
      max-width: 95vw;
      max-height: 80vh;
      display: flex;
      flex-direction: column;
      gap: 16px;
      color: var(--primary-text-color, #e0e0e0);
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
    }
    .header {
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    h2 { margin: 0; font-size: 18px; font-weight: 500; }
    button.close {
      background: none; border: none; cursor: pointer;
      font-size: 20px; color: var(--secondary-text-color, #888); padding: 2px;
    }
    .search {
      display: flex;
      align-items: center;
      gap: 8px;
      background: var(--secondary-background-color, #1e1e2e);
      border: 1px solid var(--divider-color, #444);
      border-radius: 8px;
      padding: 0 12px;
    }
    .search-icon { font-size: 16px; opacity: 0.5; flex-shrink: 0; }
    input {
      flex: 1;
      background: none;
      border: none;
      outline: none;
      color: inherit;
      font-size: 14px;
      padding: 10px 0;
    }
    .list {
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      gap: 2px;
      flex: 1;
    }
    .row {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 10px 12px;
      border-radius: 8px;
      cursor: pointer;
      transition: background 0.1s;
    }
    .row:hover { background: var(--primary-color, #03a9f4); color: #fff; }
    .domain-icon { font-size: 18px; flex-shrink: 0; width: 24px; text-align: center; }
    .names { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
    .friendly { font-size: 13px; font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .entity-id { font-size: 11px; opacity: 0.6; font-family: monospace; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .empty { text-align: center; padding: 24px; color: var(--secondary-text-color, #888); font-size: 13px; }
  `;

  firstUpdated() {
    this.shadowRoot?.querySelector('input')?.focus();
  }

  private _filtered() {
    const q = this._query.toLowerCase();
    return Object.entries(this.hass.states)
      .filter(([id]) => {
        const name = (this.hass.states[id]?.attributes?.friendly_name as string ?? '').toLowerCase();
        return id.toLowerCase().includes(q) || name.includes(q);
      })
      .slice(0, 60);
  }

  private _add(entityId: string) {
    this.dispatchEvent(new CustomEvent('add-entity', {
      detail: { entityId },
      bubbles: true,
      composed: true,
    }));
  }

  private _cancel() {
    this.dispatchEvent(new CustomEvent('cancel', { bubbles: true, composed: true }));
  }

  private _onKey(e: KeyboardEvent) {
    if (e.key === 'Escape') this._cancel();
  }

  render() {
    const results = this._filtered();
    return html`
      <div class="overlay" @click=${this._cancel}>
        <div class="dialog" @click=${(e: Event) => e.stopPropagation()} @keydown=${this._onKey}>
          <div class="header">
            <h2>Placer une entité</h2>
            <button class="close" @click=${this._cancel}>✕</button>
          </div>

          <div class="search">
            <span class="search-icon">🔍</span>
            <input
              type="text"
              placeholder="Rechercher par nom ou identifiant…"
              .value=${this._query}
              @input=${(e: Event) => (this._query = (e.target as HTMLInputElement).value)}
            />
          </div>

          <div class="list">
            ${results.length === 0
              ? html`<div class="empty">Aucune entité trouvée</div>`
              : results.map(([id, state]) => {
                  const domain = id.split('.')[0];
                  const icon = DOMAIN_ICONS[domain] ?? '📦';
                  const name = (state?.attributes?.friendly_name as string) || id;
                  return html`
                    <div class="row" @click=${() => this._add(id)}>
                      <span class="domain-icon">${icon}</span>
                      <div class="names">
                        <span class="friendly">${name}</span>
                        <span class="entity-id">${id}</span>
                      </div>
                    </div>
                  `;
                })}
          </div>
        </div>
      </div>
    `;
  }
}
