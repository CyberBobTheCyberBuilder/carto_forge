import { LitElement, html, css } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';

export const COMMON_ICONS: Array<{ icon: string; label: string }> = [
  // Lumières
  { icon: 'mdi:ceiling-light',   label: 'Plafonnier' },
  { icon: 'mdi:floor-lamp',      label: 'Lampadaire' },
  { icon: 'mdi:desk-lamp',       label: 'Lampe bureau' },
  { icon: 'mdi:lightbulb',       label: 'Ampoule' },
  { icon: 'mdi:led-strip',       label: 'Ruban LED' },
  { icon: 'mdi:string-lights',   label: 'Guirlande' },
  // Prises / interrupteurs
  { icon: 'mdi:power-socket-fr', label: 'Prise' },
  { icon: 'mdi:power',           label: 'Interrupteur' },
  { icon: 'mdi:toggle-switch',   label: 'Toggle' },
  // Capteurs
  { icon: 'mdi:thermometer',     label: 'Température' },
  { icon: 'mdi:water-percent',   label: 'Humidité' },
  { icon: 'mdi:motion-sensor',   label: 'Mouvement' },
  { icon: 'mdi:smoke-detector',  label: 'Fumée' },
  { icon: 'mdi:leak',            label: 'Fuite eau' },
  { icon: 'mdi:lightning-bolt',  label: 'Électricité' },
  // Multimédia
  { icon: 'mdi:television',      label: 'TV' },
  { icon: 'mdi:speaker',         label: 'Enceinte' },
  { icon: 'mdi:radio',           label: 'Radio' },
  { icon: 'mdi:projector',       label: 'Projecteur' },
  // Climat
  { icon: 'mdi:thermostat',      label: 'Thermostat' },
  { icon: 'mdi:air-conditioner', label: 'Clim' },
  { icon: 'mdi:fan',             label: 'Ventilateur' },
  { icon: 'mdi:radiator',        label: 'Radiateur' },
  // Accès / sécurité
  { icon: 'mdi:door',            label: 'Porte' },
  { icon: 'mdi:window-open',     label: 'Fenêtre' },
  { icon: 'mdi:lock',            label: 'Serrure' },
  { icon: 'mdi:garage',          label: 'Garage' },
  { icon: 'mdi:camera',          label: 'Caméra' },
  { icon: 'mdi:alarm-light',     label: 'Alarme' },
  { icon: 'mdi:shield-home',     label: 'Sécurité' },
  // Électroménager
  { icon: 'mdi:washing-machine', label: 'Lave-linge' },
  { icon: 'mdi:dishwasher',      label: 'Lave-vaisselle' },
  { icon: 'mdi:fridge',          label: 'Réfrigérateur' },
  { icon: 'mdi:robot-vacuum',    label: 'Aspirateur' },
  { icon: 'mdi:coffee',          label: 'Cafetière' },
  // Divers
  { icon: 'mdi:home',            label: 'Maison' },
  { icon: 'mdi:sofa',            label: 'Salon' },
  { icon: 'mdi:bed',             label: 'Chambre' },
  { icon: 'mdi:shower',          label: 'Douche' },
  { icon: 'mdi:pool',            label: 'Piscine' },
  { icon: 'mdi:help-circle',     label: 'Autre' },
];

@customElement('fp-icon-picker')
export class FpIconPicker extends LitElement {
  @property() current = '';
  @state() private _query = '';
  @state() private _custom = '';

  static styles = css`
    :host { display: block; }
    .search {
      display: flex;
      gap: 6px;
      margin-bottom: 10px;
    }
    input {
      flex: 1;
      padding: 6px 8px;
      background: var(--secondary-background-color, #333);
      border: 1px solid var(--divider-color, #555);
      border-radius: 4px;
      color: inherit;
      font-size: 13px;
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(60px, 1fr));
      gap: 4px;
      max-height: 200px;
      overflow-y: auto;
    }
    .icon-btn {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 3px;
      padding: 6px 2px;
      border: 1px solid transparent;
      border-radius: 6px;
      background: none;
      color: var(--primary-text-color, #e0e0e0);
      cursor: pointer;
      font-size: 10px;
      text-align: center;
      transition: background 0.1s;
    }
    .icon-btn:hover { background: var(--card-background-color, #333); }
    .icon-btn.selected {
      border-color: var(--primary-color, #03a9f4);
      background: rgba(3, 169, 244, 0.15);
    }
    ha-icon { --mdc-icon-size: 22px; }
    .custom-row {
      display: flex;
      gap: 6px;
      margin-top: 8px;
    }
    .custom-row button {
      padding: 6px 10px;
      background: var(--primary-color, #03a9f4);
      color: #fff;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 12px;
      white-space: nowrap;
    }
  `;

  private _filtered() {
    const q = this._query.toLowerCase();
    return q ? COMMON_ICONS.filter((i) => i.label.toLowerCase().includes(q) || i.icon.includes(q)) : COMMON_ICONS;
  }

  private _pick(icon: string) {
    this.dispatchEvent(new CustomEvent('icon-pick', { detail: icon, bubbles: true, composed: true }));
  }

  render() {
    return html`
      <input
        type="search"
        placeholder="Rechercher…"
        .value=${this._query}
        @input=${(e: Event) => (this._query = (e.target as HTMLInputElement).value)}
      />
      <div class="grid">
        ${this._filtered().map(
          ({ icon, label }) => html`
            <button
              class="icon-btn ${this.current === icon ? 'selected' : ''}"
              title="${icon}"
              @click=${() => this._pick(icon)}
            >
              <ha-icon icon="${icon}"></ha-icon>
              ${label}
            </button>
          `
        )}
      </div>
      <div class="custom-row">
        <input
          type="text"
          placeholder="mdi:mon-icone"
          .value=${this._custom}
          @input=${(e: Event) => (this._custom = (e.target as HTMLInputElement).value)}
          @keydown=${(e: KeyboardEvent) => e.key === 'Enter' && this._custom && this._pick(this._custom)}
        />
        <button @click=${() => this._custom && this._pick(this._custom)}>OK</button>
      </div>
    `;
  }
}
