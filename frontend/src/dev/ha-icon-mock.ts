/**
 * Polyfill <ha-icon> pour le serveur de dev.
 * Utilise @mdi/js pour rendre les icônes sans instance HA.
 *
 * Importé en premier dans setup.ts pour s'enregistrer avant que
 * les autres composants ne tentent d'utiliser <ha-icon>.
 */
import * as mdiIcons from '@mdi/js';

/** Convertit "mdi:ceiling-light" → "mdiCeilingLight" */
function mdiKey(icon: string): string {
  return (
    'mdi' +
    icon
      .replace(/^mdi:/, '')
      .split('-')
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join('')
  );
}

function getMdiPath(icon: string): string {
  if (!icon.startsWith('mdi:')) return '';
  return (mdiIcons as Record<string, string>)[mdiKey(icon)] ?? '';
}

class HaIconMock extends HTMLElement {
  private _icon = '';

  static get observedAttributes() {
    return ['icon'];
  }

  connectedCallback() {
    this._render();
  }

  attributeChangedCallback(_: string, __: string, newVal: string) {
    this._icon = newVal;
    this._render();
  }

  // Setter pour les bindings Lit (.icon=${...})
  set icon(val: string) {
    this._icon = val;
    this._render();
  }

  get icon() {
    return this._icon;
  }

  private _render() {
    const iconName = this._icon || this.getAttribute('icon') || '';
    const path = getMdiPath(iconName);
    // Taille via CSS custom property (--mdc-icon-size), défaut 24px
    const size = getComputedStyle(this).getPropertyValue('--mdc-icon-size').trim() || '24px';

    this.style.display = 'inline-flex';
    this.style.alignItems = 'center';
    this.style.justifyContent = 'center';

    if (path) {
      this.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg"
             viewBox="0 0 24 24"
             width="${size}" height="${size}"
             fill="currentColor"
             style="flex-shrink:0">
          <path d="${path}"/>
        </svg>`;
    } else {
      // Icône inconnue : affiche le nom en petit
      this.innerHTML = `<span style="font-size:9px;opacity:0.5;line-height:1">${iconName}</span>`;
    }
  }
}

if (!customElements.get('ha-icon')) {
  customElements.define('ha-icon', HaIconMock);
}
