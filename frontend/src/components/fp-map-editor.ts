import { LitElement, html, css } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import type { Hass } from '../utils/ha-api';
import type { FloorMap } from '../types/floorplan';

@customElement('fp-map-editor')
export class FpMapEditor extends LitElement {
  @property({ attribute: false }) map!: FloorMap;
  @property({ attribute: false }) hass!: Hass;

  @state() private _query = '';

  static styles = css`
    :host {
      display: block;
      padding: 12px;
      background: var(--secondary-background-color, #f5f5f5);
      border-top: 1px solid var(--divider-color, #e0e0e0);
    }
    input {
      width: 100%;
      padding: 6px 8px;
      box-sizing: border-box;
      margin-bottom: 8px;
      border: 1px solid var(--divider-color, #ccc);
      border-radius: 4px;
    }
    .entity-list { max-height: 180px; overflow-y: auto; }
    .entity-row {
      padding: 6px 8px;
      cursor: pointer;
      border-radius: 4px;
      font-size: 13px;
    }
    .entity-row:hover {
      background: var(--primary-color, #03a9f4);
      color: #fff;
    }
  `;

  private _filtered(): string[] {
    const q = this._query.toLowerCase();
    return Object.keys(this.hass.states)
      .filter((id) => id.toLowerCase().includes(q))
      .slice(0, 50);
  }

  private _add(entityId: string): void {
    this.dispatchEvent(
      new CustomEvent('add-entity', {
        detail: { entityId, x: this.map.width / 2, y: this.map.height / 2 },
        bubbles: true,
      })
    );
  }

  render() {
    return html`
      <input
        type="search"
        placeholder="Rechercher une entité…"
        .value=${this._query}
        @input=${(e: Event) => (this._query = (e.target as HTMLInputElement).value)}
      />
      <div class="entity-list">
        ${this._filtered().map(
          (id) => html`<div class="entity-row" @click=${() => this._add(id)}>${id}</div>`
        )}
      </div>
    `;
  }
}
