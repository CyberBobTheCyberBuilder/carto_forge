import type { FloorMap } from '../types/floorplan';

/** Sous-ensemble de l'objet `hass` injecté par HA dans le panel */
export interface Hass {
  auth: { data: { access_token: string } };
  states: Record<string, { entity_id: string; state: string; attributes: Record<string, unknown> }>;
  callService(domain: string, service: string, data?: Record<string, unknown>): Promise<void>;
  connection: {
    subscribeEvents(cb: (event: unknown) => void, eventType: string): Promise<() => void>;
  };
}

/** Appel d'un endpoint REST HA avec le token du panel */
export async function fetchApi<T>(
  hass: Hass,
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const response = await fetch(`/api${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${hass.auth.data.access_token}`,
      ...(options.headers ?? {}),
    },
  });
  if (!response.ok) {
    throw new Error(`HA API error ${response.status} on /api${path}`);
  }
  // DELETE returns 204 No Content — attempting response.json() would throw
  if (response.status === 204 || response.headers.get('content-length') === '0') {
    return undefined as unknown as T;
  }
  return response.json() as Promise<T>;
}

/** Charge la liste des cartes depuis l'intégration Python */
export function loadMaps(hass: Hass): Promise<FloorMap[]> {
  return fetchApi<FloorMap[]>(hass, '/carto_forge/maps');
}

export const TOGGLEABLE_DOMAINS = new Set([
  'switch', 'light', 'input_boolean', 'fan', 'automation',
  'script', 'scene', 'media_player', 'cover', 'lock',
  'vacuum', 'humidifier', 'remote', 'siren',
]);

/** Toggle d'une entité (lumière, prise, etc.) */
export function toggleEntity(hass: Hass, entityId: string): Promise<void> {
  const domain = entityId.split('.')[0];
  return hass.callService(domain, 'toggle', { entity_id: entityId });
}

/** Réglage de la luminosité (0-255) */
export function setBrightness(hass: Hass, entityId: string, brightness: number): Promise<void> {
  return hass.callService('light', 'turn_on', { entity_id: entityId, brightness });
}

/** Réglage de la température de couleur (mireds) */
export function setColorTemp(hass: Hass, entityId: string, colorTemp: number): Promise<void> {
  return hass.callService('light', 'turn_on', { entity_id: entityId, color_temp: colorTemp });
}
