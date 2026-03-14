import { LitElement, html, css } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import './fp-icon-picker';
import type { Hass } from '../utils/ha-api';
import { setBrightness, setColorTemp } from '../utils/ha-api';
import type { PlacedEntity } from '../types/floorplan';

@customElement('fp-options-panel')
export class FpOptionsPanel extends LitElement {
  @property() entityId!: string;
  @property({ attribute: false }) placement?: PlacedEntity;
  @property({ attribute: false }) hass!: Hass;

  @state() private _showIconPicker = false;

  static styles = css`
    :host {
      display: block;
      background: var(--card-background-color, #2d2d2d);
      border-top: 1px solid var(--divider-color, #444);
      padding: 14px 16px;
      box-shadow: 0 -4px 12px rgba(0, 0, 0, 0.3);
      animation: slide-up 0.2s ease-out;
    }
    @keyframes slide-up {
      from { transform: translateY(100%); }
      to   { transform: translateY(0); }
    }
    .header {
      display: flex;
      align-items: center;
      margin-bottom: 12px;
      gap: 8px;
    }
    ha-icon { --mdc-icon-size: 20px; color: var(--primary-color, #03a9f4); }
    h3 { flex: 1; margin: 0; font-size: 15px; font-weight: 500; }
    .btn-icon {
      padding: 4px 10px;
      font-size: 12px;
      border: 1px solid var(--divider-color, #555);
      border-radius: 4px;
      background: none;
      color: var(--primary-text-color, #e0e0e0);
      cursor: pointer;
    }
    .btn-icon:hover { background: var(--secondary-background-color, #333); }
    button.close {
      background: none;
      border: none;
      cursor: pointer;
      font-size: 18px;
      color: var(--secondary-text-color, #888);
      line-height: 1;
    }
    label { display: block; margin-bottom: 10px; font-size: 13px; color: var(--secondary-text-color, #aaa); }
    input[type="range"] { width: 100%; margin-top: 4px; accent-color: var(--primary-color, #03a9f4); }
    .icon-picker-wrap {
      border-top: 1px solid var(--divider-color, #444);
      margin-top: 10px;
      padding-top: 10px;
    }
  `;

  private _close(): void {
    this.dispatchEvent(new CustomEvent('close', { bubbles: true, composed: true }));
  }

  private _onIconPick(e: CustomEvent<string>): void {
    this.dispatchEvent(
      new CustomEvent('icon-change', {
        detail: { placementId: this.placement?.placementId, icon: e.detail },
        bubbles: true,
        composed: true,
      })
    );
    this._showIconPicker = false;
  }

  render() {
    const state = this.hass.states[this.entityId];
    const brightness = Number(state?.attributes?.['brightness'] ?? 128);
    const colorTemp = Number(state?.attributes?.['color_temp'] ?? 370);
    const name = String(state?.attributes?.['friendly_name'] ?? this.entityId);
    const domain = this.entityId.split('.')[0];
    const isLight = domain === 'light';
    const currentIcon = this.placement?.icon ?? 'mdi:help-circle';

    return html`
      <div class="header">
        <ha-icon icon="${currentIcon}"></ha-icon>
        <h3>${name}</h3>
        <button class="btn-icon" @click=${() => (this._showIconPicker = !this._showIconPicker)}>
          ${this._showIconPicker ? 'Fermer icône' : 'Icône'}
        </button>
        <button class="close" @click=${this._close}>✕</button>
      </div>

      ${this._showIconPicker
        ? html`
            <div class="icon-picker-wrap">
              <fp-icon-picker
                .current=${currentIcon}
                @icon-pick=${this._onIconPick}
              ></fp-icon-picker>
            </div>
          `
        : html`
            ${isLight
              ? html`
                  <label>
                    Luminosité
                    <input
                      type="range" min="0" max="255"
                      .value=${String(brightness)}
                      @input=${(e: Event) =>
                        setBrightness(this.hass, this.entityId, Number((e.target as HTMLInputElement).value))}
                    />
                  </label>
                  <label>
                    Température de couleur
                    <input
                      type="range" min="153" max="500"
                      .value=${String(colorTemp)}
                      @input=${(e: Event) =>
                        setColorTemp(this.hass, this.entityId, Number((e.target as HTMLInputElement).value))}
                    />
                  </label>
                `
              : html`<p style="font-size:13px;color:var(--secondary-text-color,#aaa);margin:0">
                  État : <strong>${state?.state ?? 'inconnu'}</strong>
                </p>`}
          `}
    `;
  }
}
