import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import type { PlacedEntity } from '../types/floorplan';
import './fp-icon-picker';

@customElement('fp-entity-config-dialog')
export class FpEntityConfigDialog extends LitElement {
  @property({ attribute: false }) placement!: PlacedEntity;

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
      border-radius: 12px;
      padding: 24px;
      min-width: 320px;
      max-width: 480px;
      width: 90vw;
      color: var(--primary-text-color, #e0e0e0);
    }
    .header {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 16px;
    }
    ha-icon { --mdc-icon-size: 22px; color: var(--primary-color, #03a9f4); }
    h2 { flex: 1; margin: 0; font-size: 16px; font-weight: 500; }
    .entity-id {
      font-size: 12px;
      color: var(--secondary-text-color, #888);
      font-family: monospace;
      margin-bottom: 16px;
    }
    button.close {
      background: none;
      border: none;
      cursor: pointer;
      font-size: 20px;
      color: var(--secondary-text-color, #888);
      line-height: 1;
      padding: 2px;
    }
    h3 {
      margin: 0 0 10px;
      font-size: 13px;
      font-weight: 500;
      color: var(--secondary-text-color, #aaa);
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
  `;

  private _close(): void {
    this.dispatchEvent(new CustomEvent('cancel', { bubbles: true, composed: true }));
  }

  private _onIconPick(e: CustomEvent<string>): void {
    this.dispatchEvent(new CustomEvent('icon-change', {
      detail: { placementId: this.placement.placementId, icon: e.detail },
      bubbles: true,
      composed: true,
    }));
    // Ferme automatiquement après sélection
    this._close();
  }

  render() {
    const icon = this.placement.icon ?? 'mdi:help-circle';
    return html`
      <div class="overlay" @click=${this._close}>
        <div class="dialog" @click=${(e: Event) => e.stopPropagation()}>
          <div class="header">
            <ha-icon icon="${icon}"></ha-icon>
            <h2>${this.placement.entityId}</h2>
            <button class="close" @click=${this._close}>✕</button>
          </div>
          <div class="entity-id">${this.placement.placementId}</div>

          <h3>Icône</h3>
          <fp-icon-picker
            .current=${icon}
            @icon-pick=${this._onIconPick}
          ></fp-icon-picker>
        </div>
      </div>
    `;
  }
}
