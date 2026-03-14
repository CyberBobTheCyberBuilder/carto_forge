import { LitElement, html, css } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';

@customElement('fp-label-dialog')
export class FpLabelDialog extends LitElement {
  @property() title = 'Nom';
  @property() value = '';
  @property() placeholder = 'Optionnel…';

  @state() private _value = '';

  willUpdate(changed: Map<string, unknown>): void {
    if (changed.has('value')) this._value = this.value;
  }

  firstUpdated(): void {
    const input = this.shadowRoot?.querySelector('input');
    input?.focus();
    input?.select();
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
      width: 340px;
      max-width: 95vw;
      display: flex; flex-direction: column; gap: 16px;
      color: var(--primary-text-color, #e0e0e0);
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
    }
    h2 { margin: 0; font-size: 16px; font-weight: 500; }
    input {
      width: 100%; box-sizing: border-box;
      background: var(--secondary-background-color, #1e1e2e);
      border: 1px solid var(--divider-color, #444);
      border-radius: 8px;
      color: inherit; font-size: 14px;
      padding: 10px 12px; outline: none;
    }
    input:focus { border-color: var(--primary-color, #03a9f4); }
    .footer { display: flex; justify-content: flex-end; gap: 8px; }
    .btn-cancel {
      background: none; border: none; cursor: pointer;
      color: var(--secondary-text-color, #888); font-size: 13px; padding: 6px 12px;
    }
    .btn-confirm {
      background: var(--primary-color, #03a9f4); color: #fff;
      border: none; border-radius: 8px;
      padding: 8px 20px; cursor: pointer; font-size: 13px; font-weight: 500;
    }
  `;

  private _confirm(): void {
    this.dispatchEvent(new CustomEvent('confirm', {
      detail: { label: this._value.trim() },
      bubbles: true, composed: true,
    }));
  }

  private _cancel(): void {
    this.dispatchEvent(new CustomEvent('cancel', { bubbles: true, composed: true }));
  }

  private _onKey(e: KeyboardEvent): void {
    if (e.key === 'Enter') { e.preventDefault(); this._confirm(); }
    if (e.key === 'Escape') this._cancel();
  }

  render() {
    return html`
      <div class="overlay" @click=${this._cancel}>
        <div class="dialog" @click=${(e: Event) => e.stopPropagation()} @keydown=${this._onKey}>
          <h2>${this.title}</h2>
          <input
            type="text"
            placeholder=${this.placeholder}
            .value=${this._value}
            @input=${(e: Event) => (this._value = (e.target as HTMLInputElement).value)}
          />
          <div class="footer">
            <button class="btn-cancel" @click=${this._cancel}>Annuler</button>
            <button class="btn-confirm" @click=${this._confirm}>Confirmer</button>
          </div>
        </div>
      </div>
    `;
  }
}
