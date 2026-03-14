export type ViewMode = 'view' | 'edit';
export type DrawTool = 'select' | 'wall' | 'room' | 'eraser' | 'entity';

// ---------------------------------------------------------------------------
// Éléments dessinés sur la carte
// ---------------------------------------------------------------------------

export interface WallElement {
  id: string;
  type: 'wall';
  points: Array<{ x: number; y: number }>;
  color?: string;       // défaut : '#ffffff'
  strokeWidth?: number; // défaut : 4
}

export interface RoomElement {
  id: string;
  type: 'room';
  x: number;
  y: number;
  width: number;
  height: number;
  fill?: string;   // défaut : 'rgba(255,255,255,0.05)'
  stroke?: string; // défaut : '#aaaaaa'
  label?: string;
}

export interface PolygonElement {
  id: string;
  type: 'polygon';
  points: Array<{ x: number; y: number }>;
  fill?: string;
  stroke?: string;
  label?: string;
}

export type DrawingElement = WallElement | RoomElement | PolygonElement;

// ---------------------------------------------------------------------------
// Carte et entités placées
// ---------------------------------------------------------------------------

export interface FloorMap {
  id: string;
  name: string;
  width: number;
  height: number;
  backgroundColor?: string;    // couleur de fond (défaut : '#1e1e2e')
  drawing: DrawingElement[];   // éléments dessinés à la main
  entities: PlacedEntity[];
}

export interface PlacedEntity {
  placementId: string;
  entityId: string;
  x: number;
  y: number;
  label?: string;
  icon?: string;
}
