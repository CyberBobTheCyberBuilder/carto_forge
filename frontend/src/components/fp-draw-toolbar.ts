import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import type { DrawTool } from '../types/floorplan';

interface Tool {
  id: DrawTool;
  icon: string;
  label: string;
}

const TOOLS: Tool[] = [
  { id: 'select',  icon: '↖',  label: 'Sélectionner / déplacer' },
  { id: 'wall',    icon: '━',  label: 'Mur (clic = ajouter un point, double-clic = terminer)' },
  { id: 'room',    icon: '□',  label: 'Pièce (glisser pour dessiner)' },
  { id: 'eraser',  icon: '✕',  label: 'Gomme' },
];

@customElement('fp-draw-toolbar')
export class FpDrawToolbar extends LitElement {
  @property() activeTool: DrawTool = 'select';

  static styles = css`
    :host {
      display: flex;
      align-items: center;
      gap: 4px;
      padding: 6px 12px;
      background: var(--secondary-background-color, #2a2a2a);
      border-bottom: 1px solid var(--divider-color, #444);
    }
    .label {
      font-size: 11px;
      color: var(--secondary-text-color, #aaa);
      margin-right: 8px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    button {
      width: 36px;
      height: 36px;
      border: 1px solid transparent;
      border-radius: 6px;
      background: none;
      color: var(--primary-text-color, #e0e0e0);
      cursor: pointer;
      font-size: 16px;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: background 0.15s;
      position: relative;
    }
    button:hover { background: var(--card-background-color, #333); }
    button.active {
      background: var(--primary-color, #03a9f4);
      border-color: var(--primary-color, #03a9f4);
      color: #fff;
    }
    button[title]:hover::after {
      content: attr(title);
      position: absolute;
      top: calc(100% + 6px);
      left: 50%;
      transform: translateX(-50%);
      white-space: nowrap;
      background: #000;
      color: #fff;
      font-size: 11px;
      padding: 3px 7px;
      border-radius: 4px;
      pointer-events: none;
      z-index: 10;
    }
    .hint {
      margin-left: auto;
      font-size: 11px;
      color: var(--secondary-text-color, #aaa);
      font-style: italic;
    }
  `;

  render() {
    const active = TOOLS.find((t) => t.id === this.activeTool);
    return html`
      <span class="label">Outil</span>
      ${TOOLS.map(
        (t) => html`
          <button
            class=${t.id === this.activeTool ? 'active' : ''}
            title=${t.label}
            @click=${() =>
              this.dispatchEvent(
                new CustomEvent('tool-change', { detail: t.id, bubbles: true, composed: true })
              )}
          >${t.icon}</button>
        `
      )}
      ${active ? html`<span class="hint">${active.label}</span>` : ''}
    `;
  }
}
