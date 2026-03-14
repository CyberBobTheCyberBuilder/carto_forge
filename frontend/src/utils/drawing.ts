import type { DrawingElement } from '../types/floorplan';

export const SNAP = 10;

export const snap = (v: number): number => Math.round(v / SNAP) * SNAP;

export function moveElement(el: DrawingElement, dx: number, dy: number): DrawingElement {
  if (el.type === 'wall' || el.type === 'polygon') {
    return { ...el, points: el.points.map((p) => ({ x: p.x + dx, y: p.y + dy })) };
  }
  return { ...el, x: el.x + dx, y: el.y + dy };
}

export function elementIntersectsRect(
  el: DrawingElement,
  rb: { x: number; y: number; w: number; h: number },
): boolean {
  const r = rb.x + rb.w;
  const b = rb.y + rb.h;
  if (el.type === 'room') {
    return el.x < r && el.x + el.width > rb.x && el.y < b && el.y + el.height > rb.y;
  }
  return el.points.some((p) => p.x >= rb.x && p.x <= r && p.y >= rb.y && p.y <= b);
}
