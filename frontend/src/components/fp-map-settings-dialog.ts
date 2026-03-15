import { LitElement, html, css } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import type { FloorMap } from '../types/floorplan';

@customElement('fp-map-settings-dialog')
export class FpMapSettingsDialog extends LitElement {
  @property() mode: 'create' | 'edit' = 'edit';
  @property({ attribute: false }) map?: FloorMap;

  @state() private _name = '';
  @state() private _width = 1000;
  @state() private _height = 700;
  @state() private _backgroundColor = '#1e1e2e';
  @state() private _backgroundImage: string | null = null;
  @state() private _copied = false;

  willUpdate(changed: Map<string, unknown>) {
    if (changed.has('map') && this.map) {
      this._name = this.map.name;
      this._width = this.map.width;
      this._height = this.map.height;
      this._backgroundColor = this.map.backgroundColor ?? '#1e1e2e';
      this._backgroundImage = this.map.backgroundImage ?? null;
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
    .bg-image-section { margin-bottom: 14px; }
    .bg-image-section > .field-header { margin-bottom: 6px; }
    .bg-image-controls { display: flex; gap: 8px; align-items: center; }
    .bg-preview {
      width: 56px;
      height: 40px;
      object-fit: cover;
      border-radius: 4px;
      border: 1px solid var(--divider-color, #555);
      flex-shrink: 0;
    }
    .btn-img {
      flex: 1;
      padding: 7px 10px;
      background: var(--secondary-background-color, #333);
      border: 1px solid var(--divider-color, #555);
      border-radius: 6px;
      color: var(--secondary-text-color, #aaa);
      cursor: pointer;
      font-size: 13px;
      text-align: center;
    }
    .btn-img:hover { color: var(--primary-text-color, #e0e0e0); }
    .btn-img-remove {
      padding: 7px 10px;
      background: transparent;
      border: 1px solid #e53935;
      border-radius: 6px;
      color: #e53935;
      cursor: pointer;
      font-size: 13px;
      flex-shrink: 0;
    }
    .btn-img-remove:hover { background: rgba(229,57,53,0.1); }
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

    .field-header {
      display: flex;
      align-items: center;
      gap: 6px;
      margin-bottom: 4px;
      font-size: 13px;
      color: var(--secondary-text-color, #aaa);
    }
    /* Remove the default label > span bottom margin when using field-header */
    label .field-header { margin-bottom: 4px; }
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
      width: 230px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.5);
      pointer-events: none;
      opacity: 0;
      transition: opacity 0.15s;
      z-index: 10;
    }
    .help:hover::after, .help:focus::after { opacity: 1; }
  `;

  private _copyId() {
    if (!this.map) return;
    navigator.clipboard.writeText(this.map.id).then(() => {
      this._copied = true;
      setTimeout(() => { this._copied = false; }, 1500);
    });
  }

  private _onImageFile(e: Event): void {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => { this._backgroundImage = reader.result as string; };
    reader.readAsDataURL(file);
  }

  private _save() {
    if (!this._name.trim()) return;
    if (this.mode === 'create') {
      this.dispatchEvent(new CustomEvent('create', {
        detail: {
          name: this._name.trim(),
          width: this._width,
          height: this._height,
          backgroundColor: this._backgroundColor,
          backgroundImage: this._backgroundImage,
        },
        bubbles: true, composed: true,
      }));
    } else {
      this.dispatchEvent(new CustomEvent('save', {
        detail: {
          mapId: this.map!.id,
          name: this._name.trim(),
          width: this._width,
          height: this._height,
          backgroundColor: this._backgroundColor,
          backgroundImage: this._backgroundImage,
        },
        bubbles: true, composed: true,
      }));
    }
  }

  private _delete() {
    if (!this.map) return;
    if (!confirm(`Supprimer la carte « ${this.map.name} » ? Cette action est irréversible.`)) return;
    this.dispatchEvent(new CustomEvent('map-delete', {
      detail: { mapId: this.map.id },
      bubbles: true, composed: true,
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
    const isCreate = this.mode === 'create';
    return html`
      <div class="overlay" @click=${this._cancel}>
        <div class="dialog" @click=${(e: Event) => e.stopPropagation()} @keydown=${this._onKey}>
          <h2>${isCreate ? 'Nouvelle carte' : 'Paramètres de la carte'}</h2>

          ${!isCreate && this.map ? html`
            <label>
              <div class="field-header">
                Identifiant (ID)
                <span class="help" tabindex="0"
                  data-tip="Identifiant unique de la carte. Utilisé dans les cartes Lovelace via map_id ou map_ids.">?</span>
              </div>
              <div class="id-row">
                <input type="text" readonly .value=${this.map.id} />
                <button
                  class="btn-copy ${this._copied ? 'copied' : ''}"
                  @click=${this._copyId}
                >${this._copied ? '✓ Copié' : 'Copier'}</button>
              </div>
            </label>
          ` : ''}

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

          <label>
            <div class="field-header">
              Couleur de fond
              <span class="help" tabindex="0"
                data-tip="Couleur affichée derrière le plan. Remplacée visuellement par l'image de fond si une image est importée.">?</span>
            </div>
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

          <div class="bg-image-section">
            <div class="field-header">
              Image de fond
              <span class="help" tabindex="0"
                data-tip="Photo ou plan d'architecte (PNG, JPG, SVG) affiché sous les éléments dessinés. Recommandé : même résolution que les dimensions de la carte.">?</span>
            </div>
            <div class="bg-image-controls">
              ${this._backgroundImage ? html`
                <img class="bg-preview" src=${this._backgroundImage} alt="aperçu" />
              ` : ''}
              <label class="btn-img">
                ${this._backgroundImage ? 'Remplacer' : 'Importer une image…'}
                <input type="file" accept="image/*" style="display:none"
                  @change=${this._onImageFile} />
              </label>
              ${this._backgroundImage ? html`
                <button class="btn-img-remove" @click=${() => { this._backgroundImage = null; }}>Supprimer</button>
              ` : ''}
            </div>
          </div>

          <div class="row">
            <label>
              <div class="field-header">
                Largeur (px)
                <span class="help" tabindex="0"
                  data-tip="Largeur du canvas SVG en pixels. Définit l'espace de dessin horizontal.">?</span>
              </div>
              <input
                type="number" min="200" max="4000" step="50"
                .value=${String(this._width)}
                @input=${(e: Event) => (this._width = Number((e.target as HTMLInputElement).value))}
              />
            </label>
            <label>
              <div class="field-header">
                Hauteur (px)
                <span class="help" tabindex="0"
                  data-tip="Hauteur du canvas SVG en pixels. Définit l'espace de dessin vertical.">?</span>
              </div>
              <input
                type="number" min="200" max="4000" step="50"
                .value=${String(this._height)}
                @input=${(e: Event) => (this._height = Number((e.target as HTMLInputElement).value))}
              />
            </label>
          </div>

          <div class="actions">
            ${!isCreate ? html`
              <button class="btn-delete" @click=${this._delete}>Supprimer</button>
            ` : html`<span></span>`}
            <div class="actions-right">
              <button class="btn-cancel" @click=${this._cancel}>Annuler</button>
              <button class="btn-save" ?disabled=${!this._name.trim()} @click=${this._save}>
                ${isCreate ? 'Créer' : 'Enregistrer'}
              </button>
            </div>
          </div>
        </div>
      </div>
    `;
  }
}
