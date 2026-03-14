import { describe, it, expect, beforeEach } from 'vitest';
import { AppStore } from '../store';

let store: AppStore;

beforeEach(() => {
  store = new AppStore();
});

describe('AppStore — état initial', () => {
  it('initialise avec des valeurs par défaut', () => {
    const s = store.getState();
    expect(s.maps).toEqual([]);
    expect(s.activeMapId).toBeNull();
    expect(s.viewMode).toBe('view');
    expect(s.drawTool).toBe('select');
    expect(s.loading).toBe(false);
    expect(s.error).toBeNull();
  });
});

describe('AppStore — setMaps', () => {
  it('définit les cartes et sélectionne la première', () => {
    store.setMaps([
      { id: 'a', name: 'Carte A', width: 800, height: 600, drawing: [], entities: [] },
      { id: 'b', name: 'Carte B', width: 400, height: 300, drawing: [], entities: [] },
    ]);
    expect(store.getState().maps).toHaveLength(2);
    expect(store.getState().activeMapId).toBe('a');
  });

  it('met activeMapId à null si la liste est vide', () => {
    store.setMaps([]);
    expect(store.getState().activeMapId).toBeNull();
  });
});

describe('AppStore — setActiveMap', () => {
  it('change la carte active', () => {
    store.setMaps([
      { id: 'a', name: 'A', width: 100, height: 100, drawing: [], entities: [] },
      { id: 'b', name: 'B', width: 100, height: 100, drawing: [], entities: [] },
    ]);
    store.setActiveMap('b');
    expect(store.getState().activeMapId).toBe('b');
  });
});

describe('AppStore — setViewMode', () => {
  it('repasse en vue et réinitialise l\'outil', () => {
    store.setDrawTool('wall');
    store.setViewMode('view');
    expect(store.getState().viewMode).toBe('view');
    expect(store.getState().drawTool).toBe('select');
  });
});

describe('AppStore — updateMap', () => {
  it('met à jour une carte existante', () => {
    store.setMaps([{ id: 'a', name: 'Avant', width: 100, height: 100, drawing: [], entities: [] }]);
    store.updateMap({ id: 'a', name: 'Après', width: 200, height: 200, drawing: [], entities: [] });
    expect(store.getState().maps[0].name).toBe('Après');
    expect(store.getState().maps[0].width).toBe(200);
  });
});

describe('AppStore — deleteMap', () => {
  it('supprime une carte et sélectionne la suivante', () => {
    store.setMaps([
      { id: 'a', name: 'A', width: 100, height: 100, drawing: [], entities: [] },
      { id: 'b', name: 'B', width: 100, height: 100, drawing: [], entities: [] },
    ]);
    store.deleteMap('a');
    expect(store.getState().maps).toHaveLength(1);
    expect(store.getState().activeMapId).toBe('b');
  });

  it('met activeMapId à null si plus aucune carte', () => {
    store.setMaps([{ id: 'a', name: 'A', width: 100, height: 100, drawing: [], entities: [] }]);
    store.deleteMap('a');
    expect(store.getState().activeMapId).toBeNull();
  });
});

describe('AppStore — subscribe', () => {
  it('notifie les abonnés à chaque update', () => {
    const calls: string[] = [];
    store.subscribe((s) => calls.push(s.viewMode));
    store.setViewMode('edit');
    store.setViewMode('view');
    expect(calls).toEqual(['edit', 'view']);
  });

  it('permet de se désabonner', () => {
    const calls: string[] = [];
    const unsub = store.subscribe((s) => calls.push(s.viewMode));
    store.setViewMode('edit');
    unsub();
    store.setViewMode('view');
    expect(calls).toHaveLength(1);
  });
});
