import { describe, it, expect } from 'vitest';
import { snap, SNAP, moveElement, elementIntersectsRect } from '../utils/drawing';
import type { WallElement, RoomElement, PolygonElement } from '../types/floorplan';

describe('snap', () => {
  it(`arrondit au multiple de ${SNAP} le plus proche`, () => {
    expect(snap(0)).toBe(0);
    expect(snap(5)).toBe(10);
    expect(snap(4)).toBe(0);
    expect(snap(14)).toBe(10);
    expect(snap(15)).toBe(20);
    expect(snap(23)).toBe(20);
  });

  it('fonctionne avec des valeurs négatives', () => {
    expect(snap(-5)).toBeCloseTo(0);
    expect(snap(-6)).toBe(-10);
  });
});

describe('moveElement', () => {
  it('déplace un mur (wall)', () => {
    const wall: WallElement = {
      id: 'w1',
      type: 'wall',
      points: [{ x: 0, y: 0 }, { x: 100, y: 0 }],
    };
    const moved = moveElement(wall, 10, 20);
    expect(moved.type).toBe('wall');
    if (moved.type === 'wall') {
      expect(moved.points).toEqual([{ x: 10, y: 20 }, { x: 110, y: 20 }]);
    }
  });

  it('déplace une pièce (room)', () => {
    const room: RoomElement = { id: 'r1', type: 'room', x: 50, y: 50, width: 100, height: 80 };
    const moved = moveElement(room, -10, 5);
    expect(moved.type).toBe('room');
    if (moved.type === 'room') {
      expect(moved.x).toBe(40);
      expect(moved.y).toBe(55);
    }
  });

  it('déplace un polygone', () => {
    const poly: PolygonElement = {
      id: 'p1',
      type: 'polygon',
      points: [{ x: 0, y: 0 }, { x: 50, y: 0 }, { x: 25, y: 50 }],
    };
    const moved = moveElement(poly, 5, 5);
    if (moved.type === 'polygon') {
      expect(moved.points).toEqual([{ x: 5, y: 5 }, { x: 55, y: 5 }, { x: 30, y: 55 }]);
    }
  });

  it('ne mute pas l\'élément original', () => {
    const room: RoomElement = { id: 'r1', type: 'room', x: 0, y: 0, width: 100, height: 100 };
    moveElement(room, 50, 50);
    expect(room.x).toBe(0);
  });
});

describe('elementIntersectsRect', () => {
  const rb = { x: 10, y: 10, w: 100, h: 100 };

  it('détecte une pièce qui intersecte le rect', () => {
    const room: RoomElement = { id: 'r1', type: 'room', x: 50, y: 50, width: 30, height: 30 };
    expect(elementIntersectsRect(room, rb)).toBe(true);
  });

  it('exclut une pièce hors du rect', () => {
    const room: RoomElement = { id: 'r1', type: 'room', x: 200, y: 200, width: 30, height: 30 };
    expect(elementIntersectsRect(room, rb)).toBe(false);
  });

  it('détecte un mur dont un point est dans le rect', () => {
    const wall: WallElement = {
      id: 'w1',
      type: 'wall',
      points: [{ x: 50, y: 50 }, { x: 300, y: 300 }],
    };
    expect(elementIntersectsRect(wall, rb)).toBe(true);
  });

  it('exclut un mur dont aucun point n\'est dans le rect', () => {
    const wall: WallElement = {
      id: 'w1',
      type: 'wall',
      points: [{ x: 200, y: 200 }, { x: 300, y: 300 }],
    };
    expect(elementIntersectsRect(wall, rb)).toBe(false);
  });
});
