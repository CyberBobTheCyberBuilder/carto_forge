import { LitElement, html, css, svg } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import {
  mdiCursorDefaultOutline,
  mdiVectorLine,
  mdiVectorSquare,
  mdiEraser,
  mdiMapMarkerPlus,
  mdiUndo,
  mdiRedo,
} from '@mdi/js';
import type { DrawTool } from '../types/floorplan';
import { DEFAULT_SETTINGS, type CartoForgeSettings } from '../types/settings';

interface Tool {
  id: DrawTool;
  path: string;
  label: string;
  hint: string;
}

const TOOLS: Tool[] = [
  { id: 'select', path: mdiCursorDefaultOutline, label: 'Sélection', hint: 'Sélectionner et déplacer' },
  { id: 'wall',   path: mdiVectorLine,           label: 'Mur',        hint: 'Clic = point · Double-clic = fin · 1er point = fermer' },
  { id: 'room',   path: mdiVectorSquare,         label: 'Pièce',      hint: 'Glisser pour dessiner un rectangle' },
  { id: 'eraser', path: mdiEraser,               label: 'Gomme',      hint: 'Cliquer sur un élément pour le supprimer' },
  { id: 'entity', path: mdiMapMarkerPlus,        label: 'Entité',     hint: 'Placer une entité Home Assistant' },
];

@customElement('fp-draw-toolbar')
export class FpDrawToolbar extends LitElement {
  @property() activeTool: DrawTool = 'select';
  @property({ attribute: false }) settings: CartoForgeSettings = structuredClone(DEFAULT_SETTINGS);
  @property({ type: Boolean }) canUndo = false;
  @property({ type: Boolean }) canRedo = false;

  static styles = css`
    :host {
      display: flex;
      flex-direction: column;
      gap: 4px;
      padding: 8px;
      background: var(--card-background-color, #2d2d2d);
      border-radius: 14px;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4), 0 1px 4px rgba(0, 0, 0, 0.3);
      border: 1px solid rgba(255, 255, 255, 0.06);
    }

    button {
      position: relative;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 4px;
      width: 56px;
      height: 56px;
      border: 1px solid transparent;
      border-radius: 10px;
      background: none;
      color: var(--secondary-text-color, #aaa);
      cursor: pointer;
      padding: 0;
      transition: background 0.15s, color 0.15s, border-color 0.15s;
    }

    button:hover {
      background: rgba(255, 255, 255, 0.07);
      color: var(--primary-text-color, #e0e0e0);
    }

    button.active {
      background: var(--primary-color, #03a9f4);
      border-color: transparent;
      color: #fff;
      box-shadow: 0 0 0 3px rgba(3, 169, 244, 0.25);
    }

    .icon {
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }

    .label {
      font-size: 10px;
      font-weight: 500;
      letter-spacing: 0.2px;
      line-height: 1;
    }

    .shortcut {
      position: absolute;
      top: 4px;
      right: 5px;
      font-size: 9px;
      font-weight: 600;
      color: inherit;
      opacity: 0.5;
      line-height: 1;
    }

    button.active .shortcut {
      opacity: 0.7;
    }

    button:disabled {
      opacity: 0.28;
      cursor: not-allowed;
    }

    button:disabled:hover {
      background: none;
      color: var(--secondary-text-color, #aaa);
    }

    /* Tooltip */
    button::after {
      content: attr(data-hint);
      position: absolute;
      left: calc(100% + 10px);
      top: 50%;
      transform: translateY(-50%);
      white-space: nowrap;
      background: rgba(0, 0, 0, 0.85);
      color: #fff;
      font-size: 11px;
      padding: 5px 10px;
      border-radius: 6px;
      pointer-events: none;
      opacity: 0;
      transition: opacity 0.15s;
      z-index: 100;
    }

    button:hover::after {
      opacity: 1;
    }

    .separator {
      height: 1px;
      background: rgba(255, 255, 255, 0.07);
      margin: 2px 6px;
    }
  `;

  private _keyHandler = (e: KeyboardEvent) => {
    if (!this.settings.keyboardShortcutsEnabled) return;
    if (e.ctrlKey || e.altKey || e.metaKey) return;
    const path = e.composedPath();
    if (path.some((el) => el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement)) return;
    const { shortcuts } = this.settings;
    const map: Record<string, DrawTool> = {
      [shortcuts.select]: 'select',
      [shortcuts.wall]: 'wall',
      [shortcuts.room]: 'room',
      [shortcuts.eraser]: 'eraser',
      [shortcuts.entity]: 'entity',
    };
    const tool = map[e.key.toLowerCase()];
    if (tool) {
      e.preventDefault();
      e.stopPropagation();
      this._dispatch(tool);
    }
  };

  connectedCallback() {
    super.connectedCallback();
    document.addEventListener('keydown', this._keyHandler);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    document.removeEventListener('keydown', this._keyHandler);
  }

  private _dispatch(id: DrawTool) {
    this.dispatchEvent(new CustomEvent('tool-change', { detail: id, bubbles: true, composed: true }));
  }

  private _svgIcon(path: string) {
    return svg`<svg viewBox="0 0 24 24" width="20" height="20"><path d="${path}" fill="currentColor"/></svg>`;
  }

  render() {
    const { shortcuts, keyboardShortcutsEnabled } = this.settings;
    return html`
      <button
        ?disabled=${!this.canUndo}
        data-hint="Annuler (Ctrl+Z)"
        aria-label="Annuler"
        @click=${() => this.dispatchEvent(new CustomEvent('undo', { bubbles: true, composed: true }))}
      >
        <span class="icon">${this._svgIcon(mdiUndo)}</span>
        <span class="label">Annuler</span>
      </button>
      <button
        ?disabled=${!this.canRedo}
        data-hint="Rétablir (Ctrl+Y)"
        aria-label="Rétablir"
        @click=${() => this.dispatchEvent(new CustomEvent('redo', { bubbles: true, composed: true }))}
      >
        <span class="icon">${this._svgIcon(mdiRedo)}</span>
        <span class="label">Rétablir</span>
      </button>
      <div class="separator"></div>
      ${TOOLS.map((t, i) => html`
        ${i === 3 || i === 4 ? html`<div class="separator"></div>` : ''}
        <button
          class=${t.id === this.activeTool ? 'active' : ''}
          data-hint=${t.hint}
          aria-label=${t.label}
          @click=${() => this._dispatch(t.id)}
        >
          ${keyboardShortcutsEnabled ? html`
            <span class="shortcut">${shortcuts[t.id as keyof typeof shortcuts].toUpperCase()}</span>
          ` : ''}
          <span class="icon">${this._svgIcon(t.path)}</span>
          <span class="label">${t.label}</span>
        </button>
      `)}
    `;
  }
}
