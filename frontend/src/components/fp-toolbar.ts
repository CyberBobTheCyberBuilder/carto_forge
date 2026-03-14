import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import type { ViewMode } from '../types/floorplan';

@customElement('fp-toolbar')
export class FpToolbar extends LitElement {
  @property() viewMode: ViewMode = 'view';

  static styles = css`
    :host {
      display: flex;
      align-items: center;
      padding: 0 16px;
      height: 48px;
      background: var(--app-header-background-color, #1a1a2e);
      color: var(--app-header-text-color, #fff);
      flex-shrink: 0;
    }
    h1 {
      flex: 1;
      margin: 0;
      font-size: 18px;
      font-weight: 400;
    }
    button {
      cursor: pointer;
      padding: 6px 16px;
      border: none;
      border-radius: 4px;
      background: var(--primary-color, #03a9f4);
      color: #fff;
      font-size: 13px;
    }
  `;

  render() {
    return html`
      <h1>CartoForge</h1>
      <button @click=${() => this.dispatchEvent(new CustomEvent('mode-toggle', { bubbles: true }))}>
        ${this.viewMode === 'view' ? 'Mode édition' : 'Mode vue'}
      </button>
    `;
  }
}
