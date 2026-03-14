import type { FloorMap, ViewMode, DrawTool } from './types/floorplan';

export interface AppState {
  maps: FloorMap[];
  activeMapId: string | null;
  viewMode: ViewMode;
  drawTool: DrawTool;
  loading: boolean;
  error: string | null;
}

type Listener = (state: AppState) => void;

const initialState: AppState = {
  maps: [],
  activeMapId: null,
  viewMode: 'view',
  drawTool: 'select',
  loading: false,
  error: null,
};

class AppStore {
  private state: AppState = { ...initialState };
  private listeners: Set<Listener> = new Set();

  getState(): Readonly<AppState> {
    return this.state;
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  update(partial: Partial<AppState>): void {
    this.state = { ...this.state, ...partial };
    this.listeners.forEach((l) => l(this.state));
  }

  setMaps(maps: FloorMap[]): void {
    this.update({ maps, activeMapId: maps.length > 0 ? maps[0].id : null });
  }

  setActiveMap(mapId: string): void {
    this.update({ activeMapId: mapId });
  }

  setViewMode(mode: ViewMode): void {
    // Repasser en mode vue réinitialise l'outil
    this.update({ viewMode: mode, drawTool: 'select' });
  }

  setDrawTool(tool: DrawTool): void {
    this.update({ drawTool: tool });
  }

  /** Met à jour une carte dans le store local */
  updateMap(updated: FloorMap): void {
    const maps = this.state.maps.map((m) => (m.id === updated.id ? updated : m));
    this.update({ maps });
  }

  /** Supprime une carte et ajuste la carte active */
  deleteMap(id: string): void {
    const maps = this.state.maps.filter((m) => m.id !== id);
    const activeMapId =
      this.state.activeMapId === id
        ? (maps.length > 0 ? maps[0].id : null)
        : this.state.activeMapId;
    this.update({ maps, activeMapId });
  }
}

export const store = new AppStore();
