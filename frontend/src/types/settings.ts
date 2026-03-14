export interface ShortcutMap {
  select: string;
  wall: string;
  room: string;
  eraser: string;
  entity: string;
}

export interface CartoForgeSettings {
  keyboardShortcutsEnabled: boolean;
  shortcuts: ShortcutMap;
}

export const DEFAULT_SETTINGS: CartoForgeSettings = {
  keyboardShortcutsEnabled: true,
  shortcuts: { select: 'v', wall: 'w', room: 'r', eraser: 'e', entity: 'p' },
};

const STORAGE_KEY = 'carto_forge_settings';

export function loadSettings(): CartoForgeSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return structuredClone(DEFAULT_SETTINGS);
    const parsed = JSON.parse(raw) as Partial<CartoForgeSettings>;
    return {
      keyboardShortcutsEnabled: parsed.keyboardShortcutsEnabled ?? DEFAULT_SETTINGS.keyboardShortcutsEnabled,
      shortcuts: { ...DEFAULT_SETTINGS.shortcuts, ...(parsed.shortcuts ?? {}) },
    };
  } catch {
    return structuredClone(DEFAULT_SETTINGS);
  }
}

export function saveSettings(settings: CartoForgeSettings): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}
