import './carto-forge-panel';
import './components/carto-forge-card';
import './components/carto-forge-card-editor';
import './components/fp-toolbar';
import './components/fp-map-list';
import './components/fp-map-viewer';
import './components/fp-entity-icon';
import './components/fp-options-panel';
import './components/fp-map-editor';
import './components/fp-draw-toolbar';
import './components/fp-icon-picker';
import './components/fp-map-settings-dialog';
import './components/fp-entity-config-dialog';

(window as any).customCards = (window as any).customCards || [];
(window as any).customCards.push({
  type: 'carto-forge-card',
  name: 'CartoForge',
  description: 'Plans interactifs avec entités Home Assistant',
  preview: true,
});
