import { LitElement, html, css } from 'lit';
import { customElement, state } from 'lit/decorators.js';

export interface CreateMapDetail {
  name: string;
  width: number;
  height: number;
}

@customElement('fp-create-map-dialog')
export class FpCreateMapDialog extends LitElement {
  @state() private _name = '';
  @state() private _width = 1000;
  @state() private _height = 700;

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
      min-width: 320px;
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
    .row { display: flex; gap: 12px; }
    .row label { flex: 1; }
    .actions { display: flex; justify-content: flex-end; gap: 10px; margin-top: 20px; }
    button {
      padding: 8px 18px;
      border-radius: 6px;
      border: none;
      cursor: pointer;
      font-size: 14px;
    }
    .btn-cancel { background: transparent; color: var(--secondary-text-color, #aaa); }
    .btn-create { background: var(--primary-color, #03a9f4); color: #fff; }
    .btn-create:disabled { opacity: 0.4; cursor: not-allowed; }
  `;

  private _cancel() {
    this.dispatchEvent(new CustomEvent('cancel', { bubbles: true, composed: true }));
  }

  private _create() {
    if (!this._name.trim()) return;
    const detail: CreateMapDetail = {
      name: this._name.trim(),
      width: this._width,
      height: this._height,
    };
    this.dispatchEvent(new CustomEvent('create', { detail, bubbles: true, composed: true }));
  }

  private _onKey(e: KeyboardEvent) {
    if (e.key === 'Enter') this._create();
    if (e.key === 'Escape') this._cancel();
  }

  render() {
    return html`
      <div class="overlay" @click=${this._cancel}>
        <div class="dialog" @click=${(e: Event) => e.stopPropagation()} @keydown=${this._onKey}>
          <h2>Nouvelle carte</h2>

          <label>
            <span>Nom</span>
            <input
              type="text"
              placeholder="ex. Rez-de-chaussée"
              .value=${this._name}
              @input=${(e: Event) => (this._name = (e.target as HTMLInputElement).value)}
              autofocus
            />
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
            <button class="btn-cancel" @click=${this._cancel}>Annuler</button>
            <button class="btn-create" ?disabled=${!this._name.trim()} @click=${this._create}>
              Créer
            </button>
          </div>
        </div>
      </div>
    `;
  }
}
