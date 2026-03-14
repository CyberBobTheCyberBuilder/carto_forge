import { LitElement, html, css } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import type { FloorMap } from '../types/floorplan';

@customElement('fp-map-settings-dialog')
export class FpMapSettingsDialog extends LitElement {
  @property({ attribute: false }) map!: FloorMap;

  @state() private _name = '';
  @state() private _width = 0;
  @state() private _height = 0;
  @state() private _backgroundColor = '#1e1e2e';
  @state() private _copied = false;

  willUpdate(changed: Map<string, unknown>) {
    if (changed.has('map') && this.map) {
      this._name = this.map.name;
      this._width = this.map.width;
      this._height = this.map.height;
      this._backgroundColor = this.map.backgroundColor ?? '#1e1e2e';
    }
  }

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
      padding: 28px;
      min-width: 340px;
      color: var(--primary-text-color, #e0e0e0);
    }
    h2 { margin: 0 0 20px; font-size: 18px; font-weight: 500; }
    label { display: block; margin-bottom: 14px; font-size: 13px; }
    label span { display: block; margin-bottom: 4px; color: var(--secondary-text-color, #aaa); }
    input {
      width: 100%;
      padding: 8px 10px;
      box-sizing: border-box;
      background: var(--secondary-background-color, #333);
      border: 1px solid var(--divider-color, #555);
      border-radius: 6px;
      color: inherit;
      font-size: 14px;
    }
    .id-row {
      display: flex;
      gap: 8px;
      align-items: center;
    }
    .id-row input {
      flex: 1;
      color: var(--secondary-text-color, #aaa);
      font-family: monospace;
      font-size: 12px;
      cursor: default;
    }
    .btn-copy {
      flex-shrink: 0;
      padding: 8px 12px;
      background: var(--secondary-background-color, #333);
      border: 1px solid var(--divider-color, #555);
      border-radius: 6px;
      color: var(--secondary-text-color, #aaa);
      cursor: pointer;
      font-size: 13px;
      white-space: nowrap;
      transition: color 0.2s, border-color 0.2s;
    }
    .btn-copy.copied {
      color: #4caf50;
      border-color: #4caf50;
    }
    .color-row {
      display: flex;
      gap: 10px;
      align-items: center;
    }
    input[type="color"] {
      width: 44px;
      height: 36px;
      padding: 2px;
      border-radius: 6px;
      cursor: pointer;
      flex-shrink: 0;
    }
    .color-hex {
      flex: 1;
      font-family: monospace;
    }
    .row { display: flex; gap: 12px; }
    .row label { flex: 1; }
    .actions { display: flex; justify-content: space-between; align-items: center; margin-top: 24px; }
    .actions-right { display: flex; gap: 10px; }
    button {
      padding: 8px 18px;
      border-radius: 6px;
      border: none;
      cursor: pointer;
      font-size: 14px;
    }
    .btn-cancel { background: transparent; color: var(--secondary-text-color, #aaa); }
    .btn-delete { background: transparent; color: #e53935; }
    .btn-delete:hover { background: rgba(229, 57, 53, 0.1); }
    .btn-save { background: var(--primary-color, #03a9f4); color: #fff; }
    .btn-save:disabled { opacity: 0.4; cursor: not-allowed; }
  `;

  private _copyId() {
    navigator.clipboard.writeText(this.map.id).then(() => {
      this._copied = true;
      setTimeout(() => { this._copied = false; }, 1500);
    });
  }

  private _save() {
    if (!this._name.trim()) return;
    this.dispatchEvent(new CustomEvent('save', {
      detail: { mapId: this.map.id, name: this._name.trim(), width: this._width, height: this._height, backgroundColor: this._backgroundColor },
      bubbles: true,
      composed: true,
    }));
  }

  private _delete() {
    if (!confirm(`Supprimer la carte « ${this.map.name} » ? Cette action est irréversible.`)) return;
    this.dispatchEvent(new CustomEvent('map-delete', {
      detail: { mapId: this.map.id },
      bubbles: true,
      composed: true,
    }));
  }

  private _cancel() {
    this.dispatchEvent(new CustomEvent('cancel', { bubbles: true, composed: true }));
  }

  private _onKey(e: KeyboardEvent) {
    if (e.key === 'Enter') this._save();
    if (e.key === 'Escape') this._cancel();
  }

  render() {
    return html`
      <div class="overlay" @click=${this._cancel}>
        <div class="dialog" @click=${(e: Event) => e.stopPropagation()} @keydown=${this._onKey}>
          <h2>Paramètres de la carte</h2>

          <label>
            <span>Identifiant (ID)</span>
            <div class="id-row">
              <input type="text" readonly .value=${this.map.id} />
              <button
                class="btn-copy ${this._copied ? 'copied' : ''}"
                @click=${this._copyId}
              >${this._copied ? '✓ Copié' : 'Copier'}</button>
            </div>
          </label>

          <label>
            <span>Nom</span>
            <input
              type="text"
              .value=${this._name}
              @input=${(e: Event) => (this._name = (e.target as HTMLInputElement).value)}
              autofocus
            />
          </label>

          <label>
            <span>Couleur de fond</span>
            <div class="color-row">
              <input
                type="color"
                .value=${this._backgroundColor}
                @input=${(e: Event) => (this._backgroundColor = (e.target as HTMLInputElement).value)}
              />
              <input
                type="text"
                class="color-hex"
                .value=${this._backgroundColor}
                @input=${(e: Event) => (this._backgroundColor = (e.target as HTMLInputElement).value)}
              />
            </div>
          </label>

          <div class="row">
            <label>
              <span>Largeur (px)</span>
              <input
                type="number" min="200" max="4000" step="50"
                .value=${String(this._width)}
                @input=${(e: Event) => (this._width = Number((e.target as HTMLInputElement).value))}
              />
            </label>
            <label>
              <span>Hauteur (px)</span>
              <input
                type="number" min="200" max="4000" step="50"
                .value=${String(this._height)}
                @input=${(e: Event) => (this._height = Number((e.target as HTMLInputElement).value))}
              />
            </label>
          </div>

          <div class="actions">
            <button class="btn-delete" @click=${this._delete}>Supprimer</button>
            <div class="actions-right">
              <button class="btn-cancel" @click=${this._cancel}>Annuler</button>
              <button class="btn-save" ?disabled=${!this._name.trim()} @click=${this._save}>
                Enregistrer
              </button>
            </div>
          </div>
        </div>
      </div>
    `;
  }
}
