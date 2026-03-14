/**
 * Point d'entrée de développement uniquement.
 * Monte le panel avec un objet hass simulé, sans cartes pré-existantes.
 */
import './ha-icon-mock'; // doit être importé avant tout composant qui utilise <ha-icon>
import '../main';

const mockHass = {
  auth: { data: { access_token: 'dev-token' } },
  states: {
    'light.salon':    { entity_id: 'light.salon',    state: 'on',  attributes: { friendly_name: 'Salon',    brightness: 200 } },
    'light.cuisine':  { entity_id: 'light.cuisine',  state: 'off', attributes: { friendly_name: 'Cuisine' } },
    'light.chambre':  { entity_id: 'light.chambre',  state: 'off', attributes: { friendly_name: 'Chambre' } },
    'light.bureau':   { entity_id: 'light.bureau',   state: 'on',  attributes: { friendly_name: 'Bureau',   brightness: 128 } },
    'switch.tv':      { entity_id: 'switch.tv',      state: 'on',  attributes: { friendly_name: 'TV' } },
    'switch.prise_1': { entity_id: 'switch.prise_1', state: 'off', attributes: { friendly_name: 'Prise bureau' } },
    'sensor.temp':    { entity_id: 'sensor.temp',    state: '21',  attributes: { friendly_name: 'Température', unit_of_measurement: '°C' } },
    'binary_sensor.mouvement': { entity_id: 'binary_sensor.mouvement', state: 'off', attributes: { friendly_name: 'Détecteur couloir' } },
  },
  callService: async (domain: string, service: string, data?: unknown) => {
    console.log('[mock] callService', domain, service, data);
    const entityId = (data as Record<string, string>)?.entity_id;
    if (entityId && entityId in mockHass.states) {
      const cur = mockHass.states[entityId as keyof typeof mockHass.states];
      mockHass.states = {
        ...mockHass.states,
        [entityId]: { ...cur, state: cur.state === 'on' ? 'off' : 'on' },
      };
      panel.hass = { ...mockHass };
    }
  },
  connection: { subscribeEvents: async () => () => {} },
};

await customElements.whenDefined('carto-forge-panel');
const panel = document.querySelector('carto-forge-panel') as HTMLElement & Record<string, unknown>;
panel.hass = mockHass;
panel.panel = { config: {} };
