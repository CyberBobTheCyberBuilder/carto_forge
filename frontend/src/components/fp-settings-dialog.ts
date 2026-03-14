import { LitElement, html, css } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { DEFAULT_SETTINGS, type CartoForgeSettings, type ShortcutMap } from '../types/settings';

const TOOL_LABELS: Record<keyof ShortcutMap, string> = {
  select: 'Sélection',
  wall: 'Mur',
  room: 'Pièce',
  eraser: 'Gomme',
  entity: 'Entité',
};

@customElement('fp-settings-dialog')
export class FpSettingsDialog extends LitElement {
  @property({ attribute: false }) settings!: CartoForgeSettings;

  @state() private _enabled = true;
  @state() private _shortcuts: ShortcutMap = { ...DEFAULT_SETTINGS.shortcuts };
  // key with a conflict (two tools share same key)
  @state() private _conflict: string | null = null;

  willUpdate(changed: Map<string, unknown>): void {
    if (changed.has('settings') && this.settings) {
      this._enabled = this.settings.keyboardShortcutsEnabled;
      this._shortcuts = { ...this.settings.shortcuts };
    }
  }

  static styles = css`
    .overlay {
      position: fixed; inset: 0;
      background: rgba(0, 0, 0, 0.6);
      display: flex; align-items: center; justify-content: center;
      z-index: 200;
    }
    .dialog {
      background: var(--card-background-color, #2d2d2d);
      border-radius: 14px;
      padding: 24px;
      width: 380px;
      max-width: 95vw;
      display: flex; flex-direction: column; gap: 20px;
      color: var(--primary-text-color, #e0e0e0);
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
    }
    .header { display: flex; align-items: center; justify-content: space-between; }
    h2 { margin: 0; font-size: 18px; font-weight: 500; }
    button.close {
      background: none; border: none; cursor: pointer;
      font-size: 20px; color: var(--secondary-text-color, #888); padding: 2px;
    }

    /* Toggle */
    .toggle-row {
      display: flex; align-items: center; justify-content: space-between;
      padding: 12px 14px;
      background: var(--secondary-background-color, #1e1e2e);
      border-radius: 10px;
    }
    .toggle-label { font-size: 14px; font-weight: 500; }
    .toggle {
      position: relative; width: 44px; height: 24px;
      background: var(--divider-color, #555); border-radius: 12px;
      cursor: pointer; transition: background 0.2s; border: none; padding: 0;
      flex-shrink: 0;
    }
    .toggle.on { background: var(--primary-color, #03a9f4); }
    .toggle::after {
      content: ''; position: absolute;
      top: 3px; left: 3px;
      width: 18px; height: 18px;
      background: #fff; border-radius: 50%;
      transition: transform 0.2s;
    }
    .toggle.on::after { transform: translateX(20px); }

    /* Shortcuts table */
    .shortcuts {
      display: flex; flex-direction: column; gap: 8px;
    }
    .shortcuts-title {
      font-size: 12px; font-weight: 600; text-transform: uppercase;
      letter-spacing: 0.5px; color: var(--secondary-text-color, #888);
    }
    .shortcut-row {
      display: flex; align-items: center; justify-content: space-between;
      padding: 6px 0;
    }
    .shortcut-row label { font-size: 13px; }
    .key-input {
      width: 36px; height: 32px;
      text-align: center; text-transform: uppercase;
      background: var(--secondary-background-color, #1e1e2e);
      border: 1px solid var(--divider-color, #444);
      border-radius: 6px; color: inherit; font-size: 13px; font-weight: 600;
      font-family: monospace; cursor: pointer;
      outline: none;
    }
    .key-input:focus { border-color: var(--primary-color, #03a9f4); }
    .key-input.conflict { border-color: #f44336; }
    .key-input:disabled {
      opacity: 0.35; cursor: default;
    }
    .conflict-msg {
      font-size: 11px; color: #f44336; min-height: 14px;
    }

    /* Footer */
    .footer { display: flex; align-items: center; gap: 8px; }
    .btn-reset {
      background: none; border: 1px solid var(--divider-color, #555);
      color: var(--secondary-text-color, #888); border-radius: 6px;
      padding: 6px 12px; cursor: pointer; font-size: 13px;
    }
    .btn-reset:hover { border-color: var(--primary-text-color, #e0e0e0); color: var(--primary-text-color, #e0e0e0); }
    .spacer { flex: 1; }
    .btn-cancel {
      background: none; border: none; cursor: pointer;
      color: var(--secondary-text-color, #888); font-size: 13px; padding: 6px 12px;
    }
    .btn-save {
      background: var(--primary-color, #03a9f4); color: #fff;
      border: none; border-radius: 8px; padding: 8px 20px;
      cursor: pointer; font-size: 13px; font-weight: 500;
    }
    .btn-save:disabled { opacity: 0.4; cursor: default; }
  `;

  private _checkConflicts(): string | null {
    const values = Object.values(this._shortcuts);
    const seen = new Set<string>();
    for (const v of values) {
      if (seen.has(v)) return v;
      seen.add(v);
    }
    return null;
  }

  private _onKeyInput(tool: keyof ShortcutMap, e: KeyboardEvent): void {
    e.preventDefault();
    const key = e.key.length === 1 ? e.key.toLowerCase() : null;
    if (!key) return;
    this._shortcuts = { ...this._shortcuts, [tool]: key };
    this._conflict = this._checkConflicts();
    (e.target as HTMLInputElement).value = key.toUpperCase();
  }

  private _reset(): void {
    this._shortcuts = { ...DEFAULT_SETTINGS.shortcuts };
    this._conflict = null;
  }

  private _save(): void {
    if (this._conflict) return;
    this.dispatchEvent(new CustomEvent('settings-save', {
      detail: { keyboardShortcutsEnabled: this._enabled, shortcuts: { ...this._shortcuts } },
      bubbles: true, composed: true,
    }));
  }

  private _cancel(): void {
    this.dispatchEvent(new CustomEvent('cancel', { bubbles: true, composed: true }));
  }

  render() {
    const hasConflict = this._conflict !== null;
    return html`
      <div class="overlay" @click=${this._cancel}>
        <div class="dialog" @click=${(e: Event) => e.stopPropagation()}
             @keydown=${(e: KeyboardEvent) => { if (e.key === 'Escape') this._cancel(); }}>

          <div class="header">
            <h2>⚙ Paramètres CartoForge</h2>
            <button class="close" @click=${this._cancel}>✕</button>
          </div>

          <div class="toggle-row">
            <span class="toggle-label">Raccourcis clavier</span>
            <button class="toggle ${this._enabled ? 'on' : ''}"
              @click=${() => (this._enabled = !this._enabled)}></button>
          </div>

          ${this._enabled ? html`
            <div class="shortcuts">
              <span class="shortcuts-title">Touches</span>
              ${(Object.keys(TOOL_LABELS) as Array<keyof ShortcutMap>).map((tool) => html`
                <div class="shortcut-row">
                  <label>${TOOL_LABELS[tool]}</label>
                  <input
                    class="key-input ${this._conflict && Object.entries(this._shortcuts)
                      .filter(([t, v]) => t !== tool && v === this._shortcuts[tool]).length ? 'conflict' : ''}"
                    .value=${this._shortcuts[tool].toUpperCase()}
                    @keydown=${(e: KeyboardEvent) => this._onKeyInput(tool, e)}
                    @focus=${(e: FocusEvent) => (e.target as HTMLInputElement).select()}
                    readonly
                  />
                </div>
              `)}
              <span class="conflict-msg">
                ${hasConflict ? `Conflit : la touche "${this._conflict.toUpperCase()}" est utilisée plusieurs fois` : ''}
              </span>
            </div>
          ` : html``}

          <div class="footer">
            <button class="btn-reset" @click=${this._reset}>Réinitialiser</button>
            <span class="spacer"></span>
            <button class="btn-cancel" @click=${this._cancel}>Annuler</button>
            <button class="btn-save" ?disabled=${hasConflict} @click=${this._save}>Enregistrer</button>
          </div>
        </div>
      </div>
    `;
  }
}
