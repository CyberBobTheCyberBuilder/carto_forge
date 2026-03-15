import { LitElement, html, css } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import type { RoomElement, PolygonElement } from '../types/floorplan';
import type { Hass } from '../utils/ha-api';

@customElement('fp-room-config-dialog')
export class FpRoomConfigDialog extends LitElement {
  @property({ attribute: false }) element!: RoomElement | PolygonElement;
  @property({ attribute: false }) hass?: Hass;

  @state() private _label = '';
  @state() private _stateEntity = '';
  @state() private _activeColor = '#ff5722';

  updated(changed: Map<string, unknown>): void {
    if (changed.has('element')) {
      this._label = this.element.label ?? '';
      this._stateEntity = this.element.stateEntity ?? '';
      this._activeColor = this.element.activeColor ?? '#ff5722';
    }
  }

  static styles = css`
    .overlay {
      position: fixed; inset: 0;
      background: rgba(0,0,0,0.6);
      display: flex; align-items: center; justify-content: center;
      z-index: 200;
    }
    .dialog {
      background: var(--card-background-color, #2d2d2d);
      border-radius: 12px;
      padding: 24px;
      min-width: 320px; max-width: 440px; width: 90vw;
      color: var(--primary-text-color, #e0e0e0);
      display: flex; flex-direction: column; gap: 14px;
    }
    .header {
      display: flex; align-items: center; justify-content: space-between;
      margin-bottom: 2px;
    }
    h2 { margin: 0; font-size: 16px; font-weight: 500; }
    h3 {
      margin: 0 0 8px;
      font-size: 12px; font-weight: 500;
      color: var(--secondary-text-color, #aaa);
      text-transform: uppercase; letter-spacing: 0.5px;
    }
    button.close {
      background: none; border: none; cursor: pointer;
      font-size: 20px; color: var(--secondary-text-color, #888);
      line-height: 1; padding: 2px;
    }
    label {
      display: flex; flex-direction: column; gap: 6px;
      font-size: 13px; color: var(--secondary-text-color, #aaa);
    }
    input[type="text"] {
      background: var(--input-fill-color, #3a3a3a);
      border: 1px solid var(--divider-color, #555);
      border-radius: 6px;
      color: var(--primary-text-color, #e0e0e0);
      font-size: 14px;
      padding: 8px 10px;
      width: 100%; box-sizing: border-box;
    }
    input[type="text"]:focus { outline: none; border-color: var(--primary-color, #03a9f4); }
    .color-row {
      display: flex; align-items: center; gap: 10px;
    }
    input[type="color"] {
      width: 40px; height: 32px;
      border: 1px solid var(--divider-color, #555);
      border-radius: 6px; cursor: pointer;
      padding: 2px; background: none;
    }
    .color-preview {
      width: 32px; height: 32px; border-radius: 6px;
      border: 1px solid var(--divider-color, #555);
    }
    .section { display: flex; flex-direction: column; gap: 10px; }
    .footer {
      display: flex; justify-content: flex-end; gap: 10px;
      padding-top: 14px;
      border-top: 1px solid var(--divider-color, #444);
    }
    button.cancel {
      background: none; border: 1px solid var(--divider-color, #555);
      border-radius: 6px; cursor: pointer;
      color: var(--secondary-text-color, #aaa); font-size: 13px;
      padding: 7px 16px;
    }
    button.save {
      background: var(--primary-color, #03a9f4);
      border: none; border-radius: 6px; cursor: pointer;
      color: #fff; font-size: 13px; font-weight: 500;
      padding: 7px 16px;
    }
    button.save:hover { opacity: 0.85; }

    .field-header {
      display: flex; align-items: center; gap: 6px;
    }
    .help {
      position: relative;
      display: inline-flex; align-items: center; justify-content: center;
      width: 16px; height: 16px;
      border-radius: 50%;
      background: var(--divider-color, #555);
      color: var(--secondary-text-color, #aaa);
      font-size: 10px; font-weight: 700;
      cursor: default;
      flex-shrink: 0;
    }
    .help::after {
      content: attr(data-tip);
      position: absolute;
      bottom: calc(100% + 6px);
      left: 50%; transform: translateX(-50%);
      background: #1a1a2e;
      color: #e0e0e0;
      font-size: 12px; font-weight: 400;
      line-height: 1.4;
      padding: 7px 10px;
      border-radius: 6px;
      white-space: normal;
      width: 220px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.5);
      pointer-events: none;
      opacity: 0;
      transition: opacity 0.15s;
      z-index: 10;
    }
    .help:hover::after, .help:focus::after { opacity: 1; }
  `;

  private _save(): void {
    this.dispatchEvent(new CustomEvent('room-config-update', {
      detail: {
        id: this.element.id,
        label: this._label || null,
        stateEntity: this._stateEntity || null,
        activeColor: this._stateEntity ? this._activeColor : null,
      },
      bubbles: true, composed: true,
    }));
  }

  private _close(): void {
    this.dispatchEvent(new CustomEvent('cancel', { bubbles: true, composed: true }));
  }

  render() {
    const entityIds = this.hass ? Object.keys(this.hass.states).sort() : [];
    const type = this.element.type === 'room' ? 'Pièce' : 'Polygone';
    return html`
      <div class="overlay" @click=${this._close}>
        <div class="dialog" @click=${(e: Event) => e.stopPropagation()}>
          <div class="header">
            <h2>${type}</h2>
            <button class="close" @click=${this._close}>✕</button>
          </div>

          <div class="section">
            <h3>Nom</h3>
            <label>
              <input type="text" .value=${this._label}
                @input=${(e: InputEvent) => this._label = (e.target as HTMLInputElement).value}
                placeholder="Salon, Cuisine…" />
            </label>
          </div>

          <div class="section">
            <h3>Indicateur d'état</h3>
            <label>
              <span class="field-header">
                Entité
                <span class="help" tabindex="0"
                  data-tip="ID de l'entité HA dont l'état pilote la couleur. Ex : binary_sensor.alarme, alarm_control_panel.maison">?</span>
              </span>
              <input type="text" list="entity-list-room" .value=${this._stateEntity}
                @input=${(e: InputEvent) => this._stateEntity = (e.target as HTMLInputElement).value}
                placeholder="binary_sensor.alarme" />
              <datalist id="entity-list-room">
                ${entityIds.map(id => html`<option value="${id}">`)}
              </datalist>
            </label>
            ${this._stateEntity ? html`
              <label>
                <span class="field-header">
                  Couleur active
                  <span class="help" tabindex="0"
                    data-tip="Couleur de remplissage quand l'entité est active (allumée, ouverte, armée…). Sans entité liée, la couleur de fond reste fixe.">?</span>
                </span>
                <div class="color-row">
                  <input type="color" .value=${this._activeColor}
                    @input=${(e: InputEvent) => this._activeColor = (e.target as HTMLInputElement).value} />
                  <div class="color-preview" style="background:${this._activeColor}"></div>
                  <span style="font-size:12px;font-family:monospace">${this._activeColor}</span>
                </div>
              </label>
            ` : ''}
          </div>

          <div class="footer">
            <button class="cancel" @click=${this._close}>Annuler</button>
            <button class="save" @click=${this._save}>Enregistrer</button>
          </div>
        </div>
      </div>
    `;
  }
}
