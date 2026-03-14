import { LitElement, html, css, svg, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import './fp-entity-icon';
import './fp-entity-config-dialog';
import './fp-add-entity-dialog';
import './fp-draw-toolbar';
import './fp-label-dialog';
import type {
  FloorMap, PlacedEntity, ViewMode, DrawTool,
  DrawingElement, WallElement, RoomElement, PolygonElement,
} from '../types/floorplan';
import type { Hass } from '../utils/ha-api';
import { toggleEntity } from '../utils/ha-api';
import { snap, moveElement, elementIntersectsRect } from '../utils/drawing';
import { DEFAULT_SETTINGS, type CartoForgeSettings } from '../types/settings';

const FO_HALF = 28;
const ZOOM_MIN = 0.2;
const ZOOM_MAX = 8;
// Minimum movement (SVG units) before a press becomes a drag
const DRAG_THRESHOLD = 8;

@customElement('fp-map-viewer')
export class FpMapViewer extends LitElement {
  @property({ attribute: false }) map?: FloorMap;
  @property({ attribute: false }) hass?: Hass;
  @property({ attribute: false }) settings: CartoForgeSettings = structuredClone(DEFAULT_SETTINGS);
  @property() viewMode: ViewMode = 'view';
  @property() drawTool: DrawTool = 'select';

  // Modale config entité (édition)
  @state() private _configPlacement: PlacedEntity | null = null;
  // Modale saisie de label (création pièce/polygone et édition)
  @state() private _labelDialog: {
    mode: 'room' | 'polygon' | 'edit';
    elementId?: string;
    current?: string;
  } | null = null;

  // ---- Sélection & déplacement d'éléments dessinés ----
  @state() private _selectedIds = new Set<string>();
  @state() private _selectedEntityIds = new Set<string>();
  @state() private _dragOffset: { dx: number; dy: number } | null = null;
  @state() private _rubberBand: { x: number; y: number; w: number; h: number } | null = null;
  // Origines de départ pour le drag groupé d'entités
  private _groupDragOrigins = new Map<string, { x: number; y: number }>();
  // Non-@state : ne déclenche pas de re-render pendant le geste
  private _elemDragStart: { x: number; y: number } | null = null;
  private _elemDragStarted = false;
  private _elemLongPressTimer: ReturnType<typeof setTimeout> | null = null;
  private _rubberBandStart: { x: number; y: number } | null = null;

  // ---- Drag entités ----
  // Offset visuel pendant le drag, partagé entre drag d'entités et drag d'éléments dessinés
  @state() private _entityDragOffset: { dx: number; dy: number } | null = null;
  // Coords SVG du point de départ du drag entité courant
  private _entityDragOriginSvg: { x: number; y: number } | null = null;

  // ---- Pan / pinch ----
  private _panStart: { clientX: number; clientY: number } | null = null;
  private _panOriginX = 0;
  private _panOriginY = 0;
  private _panScale = 0;
  private _activePointers = new Map<number, { x: number; y: number }>();
  private _pinchStartDist = 0;
  private _pinchStartZoom = 0;
  private _pinchStartPanX = 0;
  private _pinchStartPanY = 0;
  private _pinchCenterSvg: { x: number; y: number } | null = null;

  // ---- Zoom ----
  @state() private _zoom = 1;
  @state() private _panX = 0;
  @state() private _panY = 0;

  // ---- Undo / Redo ----
  private _undoStack: FloorMap[] = [];
  private _redoStack: FloorMap[] = [];
  @state() private _canUndo = false;
  @state() private _canRedo = false;
  private _currentMapId: string | undefined;

  // ---- Dessin ----
  @state() private _wallPoints: Array<{ x: number; y: number }> = [];
  @state() private _preview: { x: number; y: number } | null = null;
  @state() private _roomDraft: { x: number; y: number; w: number; h: number } | null = null;
  private _roomStart: { x: number; y: number } | null = null;

  static styles = css`
    :host { display: flex; flex-direction: column; width: 100%; height: 100%; overflow: hidden; position: relative; }
    .svg-wrapper { flex: 1; overflow: hidden; touch-action: none; }
    fp-draw-toolbar { position: absolute; left: 14px; top: 14px; z-index: 20; }
    svg { width: 100%; height: 100%; display: block; cursor: grab; }
    svg.tool-select { cursor: default; }
    svg.tool-wall, svg.tool-room { cursor: crosshair; }
    svg.tool-eraser { cursor: cell; }
  `;

  // -------------------------------------------------------------------------
  // Conversion coords écran → SVG
  // getScreenCTM() intègre le viewBox courant — correct quel que soit le zoom/pan
  // -------------------------------------------------------------------------
  private _toSvg(pos: { clientX: number; clientY: number }): { x: number; y: number } {
    const svgEl = this.shadowRoot!.querySelector('svg') as SVGSVGElement;
    const pt = svgEl.createSVGPoint();
    pt.x = pos.clientX;
    pt.y = pos.clientY;
    const t = pt.matrixTransform(svgEl.getScreenCTM()!.inverse());
    return { x: t.x, y: t.y };
  }

  // -------------------------------------------------------------------------
  // Zoom — Ctrl+Scroll
  // -------------------------------------------------------------------------
  private _onWheel = (e: WheelEvent): void => {
    if (!e.ctrlKey || !this.map) return;
    e.preventDefault();
    const svgPt = this._toSvg(e);
    const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15;
    const newZoom = Math.min(Math.max(this._zoom * factor, ZOOM_MIN), ZOOM_MAX);
    const ratio = this._zoom / newZoom;
    this._panX = svgPt.x - (svgPt.x - this._panX) * ratio;
    this._panY = svgPt.y - (svgPt.y - this._panY) * ratio;
    this._zoom = newZoom;
  };

  // -------------------------------------------------------------------------
  // Wrapper pointer — pan, pinch, rubber-band, drag d'éléments
  // -------------------------------------------------------------------------
  private _onWrapperPointerDown = (e: PointerEvent): void => {
    this._activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

    // Pinch (2 doigts)
    if (this._activePointers.size === 2) {
      this._panStart = null;
      this._rubberBandStart = null;
      const pts = [...this._activePointers.values()];
      this._pinchStartDist = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y);
      this._pinchStartZoom = this._zoom;
      this._pinchStartPanX = this._panX;
      this._pinchStartPanY = this._panY;
      this._pinchCenterSvg = this._toSvg({ clientX: (pts[0].x + pts[1].x) / 2, clientY: (pts[0].y + pts[1].y) / 2 });
      (e.currentTarget as Element).setPointerCapture(e.pointerId);
      return;
    }

    const inEntity = e.composedPath().some(
      (el) => (el as Element).tagName?.toLowerCase() === 'fp-entity-icon'
    );
    if (inEntity) return;

    // Mode édition + sélection → rubber-band (les éléments arrêtent la propagation)
    if (this.viewMode === 'edit' && this.drawTool === 'select') {
      if (this._elemDragStart) return; // un élément a déjà pris la main
      this._rubberBandStart = this._toSvg(e);
      (e.currentTarget as Element).setPointerCapture(e.pointerId);
      return;
    }

    if (this.viewMode === 'edit' && this.drawTool !== 'select') return;

    // Pan (mode vue ou mode édition hors select)
    const svgEl = this.shadowRoot!.querySelector('svg') as SVGSVGElement;
    this._panScale = 1 / Math.abs(svgEl.getScreenCTM()!.a);
    this._panStart = { clientX: e.clientX, clientY: e.clientY };
    this._panOriginX = this._panX;
    this._panOriginY = this._panY;
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
  };

  private _onWrapperPointerMove = (e: PointerEvent): void => {
    this._activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

    // Pinch
    if (this._activePointers.size >= 2 && this._pinchCenterSvg) {
      const pts = [...this._activePointers.values()];
      const dist = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y);
      if (this._pinchStartDist === 0) return;
      const newZoom = Math.min(Math.max(this._pinchStartZoom * (dist / this._pinchStartDist), ZOOM_MIN), ZOOM_MAX);
      const c = this._pinchCenterSvg;
      const ratio = this._pinchStartZoom / newZoom;
      this._panX = c.x - (c.x - this._pinchStartPanX) * ratio;
      this._panY = c.y - (c.y - this._pinchStartPanY) * ratio;
      this._zoom = newZoom;
      return;
    }

    // Drag d'éléments sélectionnés
    if (this._elemDragStart) {
      const cur = this._toSvg(e);
      const dx = cur.x - this._elemDragStart.x;
      const dy = cur.y - this._elemDragStart.y;
      if (!this._elemDragStarted) {
        if (Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
        this._elemDragStarted = true;
      }
      if (!this._elemDragStarted && Math.hypot(dx, dy) >= DRAG_THRESHOLD) {
        // Le drag commence : annuler le long press
        if (this._elemLongPressTimer) { clearTimeout(this._elemLongPressTimer); this._elemLongPressTimer = null; }
      }
      this._dragOffset = { dx, dy };
      // Si des entités sont sélectionnées, les faire suivre visuellement
      if (this._groupDragOrigins.size > 0) this._entityDragOffset = { dx, dy };
      return;
    }

    // Rubber-band
    if (this._rubberBandStart) {
      const cur = this._toSvg(e);
      this._rubberBand = {
        x: Math.min(this._rubberBandStart.x, cur.x),
        y: Math.min(this._rubberBandStart.y, cur.y),
        w: Math.abs(cur.x - this._rubberBandStart.x),
        h: Math.abs(cur.y - this._rubberBandStart.y),
      };
      return;
    }

    // Pan
    if (!this._panStart) return;
    this._panX = this._panOriginX - (e.clientX - this._panStart.clientX) * this._panScale;
    this._panY = this._panOriginY - (e.clientY - this._panStart.clientY) * this._panScale;
  };

  private _onWrapperPointerUp = (e: PointerEvent): void => {
    this._activePointers.delete(e.pointerId);
    if (this._activePointers.size < 2) this._pinchCenterSvg = null;
    if (this._activePointers.size === 0) this._panStart = null;

    // Commit drag d'éléments
    if (this._elemDragStart) {
      if (this._elemDragStarted && this._dragOffset && this.map) {
        const dx = snap(this._dragOffset.dx);
        const dy = snap(this._dragOffset.dy);
        const drawing = this.map.drawing.map((el) =>
          this._selectedIds.has(el.id) ? moveElement(el, dx, dy) : el
        );
        // Commit aussi les entités sélectionnées
        const entities = this._groupDragOrigins.size > 0
          ? this.map.entities.map((en) => {
              const origin = this._groupDragOrigins.get(en.placementId);
              return origin ? { ...en, x: snap(origin.x + dx), y: snap(origin.y + dy) } : en;
            })
          : this.map.entities;
        this._emitMapUpdate({ ...this.map, drawing, entities });
      }
      this._elemDragStart = null;
      this._elemDragStarted = false;
      this._dragOffset = null;
      this._entityDragOffset = null;
      this._groupDragOrigins.clear();
      this._rubberBandStart = null;
      this._rubberBand = null;
      if (this._elemLongPressTimer) { clearTimeout(this._elemLongPressTimer); this._elemLongPressTimer = null; }
      return;
    }

    // Fin rubber-band → sélectionne les éléments et entités dans le rect
    if (this._rubberBandStart) {
      if (this._rubberBand && (this._rubberBand.w > 4 || this._rubberBand.h > 4)) {
        const rb = this._rubberBand;
        this._selectedIds = new Set(
          this.map?.drawing.filter((el) => elementIntersectsRect(el, rb)).map((el) => el.id) ?? []
        );
        this._selectedEntityIds = new Set(
          this.map?.entities
            .filter((en) => en.x >= rb.x && en.x <= rb.x + rb.w && en.y >= rb.y && en.y <= rb.y + rb.h)
            .map((en) => en.placementId) ?? []
        );
      } else {
        this._selectedIds = new Set();
        this._selectedEntityIds = new Set();
      }
      this._rubberBand = null;
      this._rubberBandStart = null;
    }
  };

  // -------------------------------------------------------------------------
  // Éléments dessinés — sélection + drag
  // -------------------------------------------------------------------------
  private _onElementPointerDown(e: PointerEvent, el: DrawingElement): void {
    if (this.viewMode !== 'edit' || this.drawTool !== 'select') return;
    e.stopPropagation(); // empêche le rubber-band de démarrer

    if (e.shiftKey) {
      const next = new Set(this._selectedIds);
      if (next.has(el.id)) { next.delete(el.id); } else { next.add(el.id); }
      this._selectedIds = next;
    } else if (!this._selectedIds.has(el.id)) {
      this._selectedIds = new Set([el.id]);
    }

    // Route les pointermove/up suivants vers le wrapper
    const wrapper = this.shadowRoot!.querySelector('.svg-wrapper') as HTMLElement;
    wrapper?.setPointerCapture(e.pointerId);

    this._elemDragStart = this._toSvg(e);
    this._elemDragStarted = false;

    // Long press → ouvre la modale de label (pièces et polygones uniquement)
    if (el.type !== 'wall') {
      this._elemLongPressTimer = setTimeout(() => {
        this._elemLongPressTimer = null;
        if (!this._elemDragStarted) {
          this._labelDialog = {
            mode: 'edit',
            elementId: el.id,
            current: (el as { label?: string }).label,
          };
        }
      }, 600);
    }

    // Prépare le drag groupé des entités sélectionnées
    this._groupDragOrigins.clear();
    for (const pid of this._selectedEntityIds) {
      const en = this.map?.entities.find((en) => en.placementId === pid);
      if (en) this._groupDragOrigins.set(pid, { x: en.x, y: en.y });
    }
  }

  // -------------------------------------------------------------------------
  // Entités — clic / config
  // -------------------------------------------------------------------------
  private _onEntityClick = (e: CustomEvent): void => {
    if (this.hass) toggleEntity(this.hass, e.detail.entityId);
  };

  private _onEntityConfig = (e: CustomEvent): void => {
    this._configPlacement =
      this.map?.entities.find((en) => en.placementId === e.detail.placementId) ?? null;
  };

  private _onIconChange = (e: CustomEvent<{ placementId: string; icon: string }>): void => {
    if (!this.map) return;
    const { placementId, icon } = e.detail;
    const entities = this.map.entities.map((en) =>
      en.placementId === placementId ? { ...en, icon } : en
    );
    this._emitMapUpdate({ ...this.map, entities });
  };

  private _onEntityRemove = (e: CustomEvent<{ placementId: string }>): void => {
    if (!this.map) return;
    const entities = this.map.entities.filter((en) => en.placementId !== e.detail.placementId);
    this._emitMapUpdate({ ...this.map, entities });
    this._configPlacement = null;
  };

  // -------------------------------------------------------------------------
  // Drag entités — manipulation DOM directe, zéro re-render pendant le mouvement
  // -------------------------------------------------------------------------
  private _onDragStart = (e: CustomEvent): void => {
    const { placementId, clientX, clientY } = e.detail;
    const placement = this.map?.entities.find((en) => en.placementId === placementId);
    if (!placement) return;

    this._entityDragOriginSvg = this._toSvg({ clientX, clientY });

    // Toutes les entités à déplacer (entité cliquée + groupe sélectionné)
    this._groupDragOrigins.clear();
    this._groupDragOrigins.set(placementId, { x: placement.x, y: placement.y });
    if (this._selectedEntityIds.has(placementId) && this._selectedEntityIds.size > 1) {
      for (const pid of this._selectedEntityIds) {
        if (pid === placementId) continue;
        const en = this.map?.entities.find((en) => en.placementId === pid);
        if (en) this._groupDragOrigins.set(pid, { x: en.x, y: en.y });
      }
    }

    // Si des éléments dessinés sont aussi sélectionnés, les faire suivre
    if (this._selectedIds.size > 0) {
      this._elemDragStart = this._entityDragOriginSvg;
      this._elemDragStarted = true;
    }
  };

  private _onDragMove = (e: CustomEvent): void => {
    if (!this._entityDragOriginSvg) return;
    const cur = this._toSvg(e.detail);
    const dx = cur.x - this._entityDragOriginSvg.x;
    const dy = cur.y - this._entityDragOriginSvg.y;
    this._entityDragOffset = { dx, dy };
    // Faire suivre visuellement les éléments dessinés sélectionnés
    if (this._elemDragStart) this._dragOffset = { dx, dy };
  };

  private _onDragEnd = (e: CustomEvent): void => {
    if (!this.map || !this._entityDragOriginSvg) return;
    const cur = this._toSvg(e.detail);
    const dx = snap(cur.x - this._entityDragOriginSvg.x);
    const dy = snap(cur.y - this._entityDragOriginSvg.y);

    // Commit entités
    const entities = this.map.entities.map((en) => {
      const origin = this._groupDragOrigins.get(en.placementId);
      return origin ? { ...en, x: snap(origin.x + dx), y: snap(origin.y + dy) } : en;
    });

    // Commit éléments dessinés sélectionnés
    const drawing = this._elemDragStarted && this._selectedIds.size > 0
      ? this.map.drawing.map((el) => this._selectedIds.has(el.id) ? moveElement(el, dx, dy) : el)
      : this.map.drawing;

    this._emitMapUpdate({ ...this.map, entities, drawing });
    this._entityDragOriginSvg = null;
    this._entityDragOffset = null;
    this._groupDragOrigins.clear();
    this._elemDragStart = null;
    this._elemDragStarted = false;
    this._dragOffset = null;
  };

  // -------------------------------------------------------------------------
  // Ajout d'entité
  // -------------------------------------------------------------------------
  private readonly _DOMAIN_ICONS: Record<string, string> = {
    light: 'mdi:ceiling-light', switch: 'mdi:power-socket',
    sensor: 'mdi:thermometer', binary_sensor: 'mdi:motion-sensor',
    media_player: 'mdi:television', climate: 'mdi:thermostat',
    cover: 'mdi:window-shutter',
  };

  private _placeEntity(entityId: string, x: number, y: number): void {
    if (!this.map) return;
    const newEntity: PlacedEntity = {
      placementId: crypto.randomUUID(),
      entityId,
      x, y,
      icon: this._DOMAIN_ICONS[entityId.split('.')[0]] ?? 'mdi:help-circle',
    };
    this._emitMapUpdate({ ...this.map, entities: [...this.map.entities, newEntity] });
  }

  // Appelé depuis la modale (outil 'entity')
  private _onDialogAddEntity = (e: CustomEvent): void => {
    if (!this.map) return;
    const cx = snap(this._panX + this.map.width / (2 * this._zoom));
    const cy = snap(this._panY + this.map.height / (2 * this._zoom));
    this._placeEntity(e.detail.entityId, cx, cy);
    this._dispatchToolChange('select');
  };

  private _onDialogCancel = (): void => {
    this._dispatchToolChange('select');
  };

  private _dispatchToolChange(tool: DrawTool): void {
    this.dispatchEvent(new CustomEvent('tool-change', { detail: tool, bubbles: true, composed: true }));
  }

  // -------------------------------------------------------------------------
  // Dessin
  // -------------------------------------------------------------------------
  private _snapSvg(pos: { clientX: number; clientY: number }) {
    const p = this._toSvg(pos);
    return { x: snap(p.x), y: snap(p.y) };
  }

  private _onSvgPointerDown(e: PointerEvent): void {
    const p = this._snapSvg(e);
    if (this.drawTool === 'wall') {
      if (this._wallPoints.length >= 2) {
        const first = this._wallPoints[0];
        if (p.x === first.x && p.y === first.y) { this._closeWallAsPolygon(); return; }
      }
      this._wallPoints = [...this._wallPoints, p];
    } else if (this.drawTool === 'room') {
      this._roomStart = p;
      this._roomDraft = { x: p.x, y: p.y, w: 0, h: 0 };
    }
  }

  private _onSvgPointerMove(e: PointerEvent): void {
    const p = this._snapSvg(e);
    if (this.drawTool === 'wall') {
      this._preview = p;
    } else if (this.drawTool === 'room' && this._roomStart && e.buttons === 1) {
      this._roomDraft = {
        x: Math.min(this._roomStart.x, p.x), y: Math.min(this._roomStart.y, p.y),
        w: Math.abs(p.x - this._roomStart.x), h: Math.abs(p.y - this._roomStart.y),
      };
    }
  }

  private _onSvgPointerUp(): void {
    if (!this.map || this.drawTool !== 'room') return;
    if (this._roomDraft && this._roomDraft.w > 10 && this._roomDraft.h > 10) {
      this._labelDialog = { mode: 'room' };
    } else {
      this._roomDraft = null;
      this._roomStart = null;
    }
  }

  private _closeWallAsPolygon(): void {
    if (!this.map) return;
    this._labelDialog = { mode: 'polygon' };
    // _wallPoints conservés jusqu'à la confirmation
  }

  private _editElementLabel(e: Event, elementId: string, currentLabel?: string): void {
    if (this.viewMode !== 'edit' || this.drawTool !== 'select') return;
    e.stopPropagation();
    this._labelDialog = { mode: 'edit', elementId, current: currentLabel };
  }

  private _onLabelConfirm = (e: CustomEvent<{ label: string }>): void => {
    const dialog = this._labelDialog;
    this._labelDialog = null;
    if (!dialog || !this.map) return;
    const { label } = e.detail;

    if (dialog.mode === 'room' && this._roomDraft) {
      const el: RoomElement = {
        id: crypto.randomUUID(), type: 'room',
        x: this._roomDraft.x, y: this._roomDraft.y,
        width: this._roomDraft.w, height: this._roomDraft.h,
        ...(label ? { label } : {}),
      };
      this._emitMapUpdate({ ...this.map, drawing: [...this.map.drawing, el] });
      this._roomDraft = null;
      this._roomStart = null;
    } else if (dialog.mode === 'polygon') {
      const el: PolygonElement = {
        id: crypto.randomUUID(), type: 'polygon',
        points: [...this._wallPoints],
        ...(label ? { label } : {}),
      };
      this._emitMapUpdate({ ...this.map, drawing: [...this.map.drawing, el] });
      this._wallPoints = [];
      this._preview = null;
    } else if (dialog.mode === 'edit' && dialog.elementId) {
      this._emitMapUpdate({
        ...this.map,
        drawing: this.map.drawing.map((d) =>
          d.id === dialog.elementId ? { ...d, label: label || undefined } : d
        ),
      });
    }
  };

  private _onLabelCancel = (): void => {
    const dialog = this._labelDialog;
    this._labelDialog = null;
    if (!dialog || !this.map) return;
    // Création sans label (la forme est déjà dessinée)
    if (dialog.mode === 'room' && this._roomDraft) {
      const el: RoomElement = {
        id: crypto.randomUUID(), type: 'room',
        x: this._roomDraft.x, y: this._roomDraft.y,
        width: this._roomDraft.w, height: this._roomDraft.h,
      };
      this._emitMapUpdate({ ...this.map, drawing: [...this.map.drawing, el] });
      this._roomDraft = null;
      this._roomStart = null;
    } else if (dialog.mode === 'polygon') {
      const el: PolygonElement = {
        id: crypto.randomUUID(), type: 'polygon',
        points: [...this._wallPoints],
      };
      this._emitMapUpdate({ ...this.map, drawing: [...this.map.drawing, el] });
      this._wallPoints = [];
      this._preview = null;
    }
    // mode 'edit' : annuler = ne rien changer
  };

  private _onSvgDblClick(): void {
    if (!this.map || this.drawTool !== 'wall' || this._wallPoints.length < 2) return;
    const el: WallElement = { id: crypto.randomUUID(), type: 'wall', points: [...this._wallPoints] };
    this._emitMapUpdate({ ...this.map, drawing: [...this.map.drawing, el] });
    this._wallPoints = [];
    this._preview = null;
  }

  private _onKeyDown = (e: KeyboardEvent): void => {
    if (e.key === 'Escape') {
      this._wallPoints = [];
      this._preview = null;
      this._roomDraft = null;
      this._roomStart = null;
      this._selectedIds = new Set();
      this._selectedEntityIds = new Set();
      return;
    }
    if (e.ctrlKey || e.metaKey) {
      if (e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        this._undo();
        return;
      }
      if (e.key === 'y' || (e.key === 'z' && e.shiftKey)) {
        e.preventDefault();
        this._redo();
        return;
      }
    }
  };

  private _eraseElement(id: string): void {
    if (!this.map || this.drawTool !== 'eraser') return;
    this._emitMapUpdate({ ...this.map, drawing: this.map.drawing.filter((el) => el.id !== id) });
  }

  // Quand la carte change (autre map_id) → reset l'historique
  override updated(changed: Map<string, unknown>): void {
    if (changed.has('map') && this.map?.id !== this._currentMapId) {
      this._undoStack = [];
      this._redoStack = [];
      this._canUndo = false;
      this._canRedo = false;
      this._currentMapId = this.map?.id;
    }
  }

  private _emitMapUpdate(map: FloorMap): void {
    if (this.map) {
      this._undoStack = [...this._undoStack.slice(-49), this.map];
      this._redoStack = [];
      this._canUndo = true;
      this._canRedo = false;
    }
    this.dispatchEvent(new CustomEvent('map-updated', { detail: map, bubbles: true, composed: true }));
  }

  private _undo(): void {
    if (!this.map || this._undoStack.length === 0) return;
    const prev = this._undoStack[this._undoStack.length - 1];
    this._redoStack = [...this._redoStack.slice(-49), this.map];
    this._undoStack = this._undoStack.slice(0, -1);
    this._canUndo = this._undoStack.length > 0;
    this._canRedo = true;
    this.dispatchEvent(new CustomEvent('map-updated', { detail: prev, bubbles: true, composed: true }));
  }

  private _redo(): void {
    if (!this.map || this._redoStack.length === 0) return;
    const next = this._redoStack[this._redoStack.length - 1];
    this._undoStack = [...this._undoStack.slice(-49), this.map];
    this._redoStack = this._redoStack.slice(0, -1);
    this._canUndo = true;
    this._canRedo = this._redoStack.length > 0;
    this.dispatchEvent(new CustomEvent('map-updated', { detail: next, bubbles: true, composed: true }));
  }

  connectedCallback(): void {
    super.connectedCallback();
    window.addEventListener('keydown', this._onKeyDown);
    this.addEventListener('wheel', this._onWheel, { passive: false });
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    window.removeEventListener('keydown', this._onKeyDown);
    this.removeEventListener('wheel', this._onWheel);
  }

  // -------------------------------------------------------------------------
  // Rendu des éléments dessinés
  // -------------------------------------------------------------------------
  private _renderDrawing(elements: DrawingElement[]) {
    return elements.map((el) => {
      const isSelected = this._selectedIds.has(el.id);
      const dx = isSelected && this._dragOffset ? this._dragOffset.dx : 0;
      const dy = isSelected && this._dragOffset ? this._dragOffset.dy : 0;
      const transform = dx !== 0 || dy !== 0 ? `translate(${dx},${dy})` : '';
      const eraserStyle = this.drawTool === 'eraser' ? 'cursor:cell' : '';
      const selectPointerDown = this.drawTool === 'select'
        ? (e: PointerEvent) => this._onElementPointerDown(e, el)
        : undefined;

      if (el.type === 'wall') {
        const pts = el.points.map((p) => `${p.x},${p.y}`).join(' ');
        return svg`
          <g transform="${transform}" style="${eraserStyle}"
            @pointerdown=${selectPointerDown}
            @click=${() => this._eraseElement(el.id)}
          >
            <polyline points="${pts}"
              fill="none" stroke="${el.color ?? '#ffffff'}" stroke-width="${el.strokeWidth ?? 4}"
              stroke-linecap="round" stroke-linejoin="round"/>
            ${isSelected ? svg`
              <polyline points="${pts}" fill="none"
                stroke="#03a9f4" stroke-width="2" stroke-dasharray="6 3"
                stroke-linecap="round" opacity="0.9" style="pointer-events:none"/>
            ` : nothing}
          </g>`;
      } else if (el.type === 'room') {
        return svg`
          <g transform="${transform}" style="${eraserStyle}"
            @pointerdown=${selectPointerDown}
            @click=${() => this._eraseElement(el.id)}
            @dblclick=${(e: Event) => this._editElementLabel(e, el.id, el.label)}
          >
            <rect x="${el.x}" y="${el.y}" width="${el.width}" height="${el.height}"
              fill="${el.fill ?? 'rgba(255,255,255,0.05)'}"
              stroke="${isSelected ? '#03a9f4' : (el.stroke ?? '#aaaaaa')}"
              stroke-width="${isSelected ? 2 : 2}"
              stroke-dasharray="${isSelected ? '6 3' : 'none'}"/>
            ${el.label ? svg`
              <text x="${el.x + el.width / 2}" y="${el.y + el.height / 2}"
                text-anchor="middle" dominant-baseline="middle"
                fill="#888" font-size="16">${el.label}</text>` : nothing}
          </g>`;
      } else {
        // Centroid = average of vertices
        const cx = el.points.reduce((s, p) => s + p.x, 0) / el.points.length;
        const cy = el.points.reduce((s, p) => s + p.y, 0) / el.points.length;
        const pts = el.points.map((p) => `${p.x},${p.y}`).join(' ');
        return svg`
          <g transform="${transform}" style="${eraserStyle}"
            @pointerdown=${selectPointerDown}
            @click=${() => this._eraseElement(el.id)}
            @dblclick=${(e: Event) => this._editElementLabel(e, el.id, el.label)}
          >
            <polygon points="${pts}"
              fill="${el.fill ?? 'rgba(255,255,255,0.05)'}"
              stroke="${isSelected ? '#03a9f4' : (el.stroke ?? '#aaaaaa')}"
              stroke-width="2"
              stroke-dasharray="${isSelected ? '6 3' : 'none'}"
              stroke-linejoin="round"/>
            ${el.label ? svg`
              <text x="${cx}" y="${cy}"
                text-anchor="middle" dominant-baseline="middle"
                fill="#888" font-size="16">${el.label}</text>` : nothing}
          </g>`;
      }
    });
  }

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------
  render() {
    if (!this.map) return html``;
    const { backgroundColor, width, height, drawing, entities } = this.map;
    const isDrawing = this.viewMode === 'edit' && (this.drawTool === 'wall' || this.drawTool === 'room');
    const viewBox = `${this._panX} ${this._panY} ${width / this._zoom} ${height / this._zoom}`;
    const selCount = this._selectedIds.size + this._selectedEntityIds.size;

    return html`
      ${this.viewMode === 'edit'
        ? html`<fp-draw-toolbar
            .activeTool=${this.drawTool}
            .settings=${this.settings}
            .canUndo=${this._canUndo}
            .canRedo=${this._canRedo}
            @tool-change=${(e: CustomEvent<DrawTool>) => {
              this._selectedIds = new Set();
              this._selectedEntityIds = new Set();
              this.dispatchEvent(new CustomEvent('tool-change', { detail: e.detail, bubbles: true, composed: true }));
            }}
            @undo=${() => this._undo()}
            @redo=${() => this._redo()}
          ></fp-draw-toolbar>`
        : nothing}

      <div class="svg-wrapper"
        @fp-click=${this._onEntityClick}
        @fp-entity-config=${this._onEntityConfig}
        @icon-change=${this._onIconChange}
        @entity-remove=${this._onEntityRemove}
        @fp-drag-start=${this._onDragStart}
        @fp-drag-move=${this._onDragMove}
        @fp-drag-end=${this._onDragEnd}
        @pointerdown=${this._onWrapperPointerDown}
        @pointermove=${this._onWrapperPointerMove}
        @pointerup=${this._onWrapperPointerUp}
        @pointercancel=${this._onWrapperPointerUp}
      >
        <svg class="tool-${this.drawTool}"
          viewBox="${viewBox}" preserveAspectRatio="xMidYMid meet">

          <rect x="0" y="0" width="${width}" height="${height}"
            fill="${backgroundColor ?? '#1e1e2e'}"/>

          ${this.map.backgroundImage ? svg`
            <image href="${this.map.backgroundImage}"
              x="0" y="0" width="${width}" height="${height}"
              preserveAspectRatio="xMidYMid meet"
              style="pointer-events:none"/>
          ` : nothing}

          ${this._renderDrawing(drawing)}

          <!-- Prévisualisation mur -->
          ${this.drawTool === 'wall' && this._wallPoints.length > 0 && this._preview ? svg`
            ${(() => {
              const preview = this._preview!;
              const first = this._wallPoints[0];
              const canClose = this._wallPoints.length >= 2
                && preview.x === first.x && preview.y === first.y;
              return svg`
                <polyline
                  points="${[...this._wallPoints, preview].map((p) => `${p.x},${p.y}`).join(' ')}"
                  fill="none" stroke="#03a9f4" stroke-width="3"
                  stroke-dasharray="6 4" stroke-linecap="round" style="pointer-events:none"/>
                ${this._wallPoints.map((p, i) => svg`
                  <circle cx="${p.x}" cy="${p.y}"
                    r="${i === 0 && canClose ? 8 : 4}"
                    fill="${i === 0 && canClose ? '#4caf50' : '#03a9f4'}"
                    style="pointer-events:none"/>
                `)}
                ${canClose ? svg`
                  <polygon
                    points="${this._wallPoints.map((p) => `${p.x},${p.y}`).join(' ')}"
                    fill="rgba(76,175,80,0.1)" stroke="#4caf50"
                    stroke-width="2" stroke-dasharray="6 4" style="pointer-events:none"/>
                ` : nothing}`;
            })()}
          ` : nothing}

          <!-- Prévisualisation pièce -->
          ${this.drawTool === 'room' && this._roomDraft && this._roomDraft.w > 0 ? svg`
            <rect x="${this._roomDraft.x}" y="${this._roomDraft.y}"
              width="${this._roomDraft.w}" height="${this._roomDraft.h}"
              fill="rgba(3,169,244,0.1)" stroke="#03a9f4"
              stroke-width="2" stroke-dasharray="6 4" style="pointer-events:none"/>` : nothing}

          <!-- Rubber-band de sélection -->
          ${this._rubberBand && this._rubberBand.w > 4 ? svg`
            <rect
              x="${this._rubberBand.x}" y="${this._rubberBand.y}"
              width="${this._rubberBand.w}" height="${this._rubberBand.h}"
              fill="rgba(3,169,244,0.08)" stroke="#03a9f4"
              stroke-width="1" stroke-dasharray="5 3" style="pointer-events:none"/>
          ` : nothing}

          <!-- Entités -->
          ${entities.map((placed: PlacedEntity) => {
            const isEntitySelected = this._selectedEntityIds.has(placed.placementId);
            const isDragging = this._groupDragOrigins.has(placed.placementId) && this._entityDragOffset !== null;
            const vx = placed.x + (isDragging ? this._entityDragOffset!.dx : 0);
            const vy = placed.y + (isDragging ? this._entityDragOffset!.dy : 0);
            return svg`
              ${isEntitySelected ? svg`
                <circle cx="${vx}" cy="${vy}" r="${FO_HALF - 2}"
                  fill="none" stroke="#03a9f4" stroke-width="2"
                  stroke-dasharray="6 3" style="pointer-events:none"/>
              ` : nothing}
              <foreignObject
                data-pid="${placed.placementId}"
                x="${vx - FO_HALF}" y="${vy - FO_HALF}"
                width="${FO_HALF * 2}" height="${FO_HALF * 2}"
                overflow="visible"
              >
                <fp-entity-icon
                  xmlns="http://www.w3.org/1999/xhtml"
                  .placement=${placed}
                  .entityState=${this.hass?.states[placed.entityId]}
                  .viewMode=${this.viewMode}
                  .drawTool=${this.drawTool}
                ></fp-entity-icon>
              </foreignObject>
            `;
          })}

          <!-- Zone de capture dessin (wall/room uniquement) -->
          ${isDrawing ? svg`
            <rect x="0" y="0" width="${width}" height="${height}"
              fill="transparent" style="pointer-events:all"
              @pointerdown=${this._onSvgPointerDown}
              @pointermove=${this._onSvgPointerMove}
              @pointerup=${this._onSvgPointerUp}
              @dblclick=${this._onSvgDblClick}/>` : nothing}
        </svg>
      </div>

      <!-- Indicateur de sélection -->
      ${this.viewMode === 'edit' && selCount > 0 ? html`
        <div style="
          position:absolute; bottom:8px; left:50%; transform:translateX(-50%);
          background:rgba(3,169,244,0.85); color:#fff; border-radius:12px;
          padding:4px 14px; font-size:12px; pointer-events:none;
        ">
          ${selCount} élément${selCount > 1 ? 's' : ''} sélectionné${selCount > 1 ? 's' : ''}
        </div>
      ` : nothing}

      ${this._configPlacement ? html`
        <fp-entity-config-dialog
          .placement=${this._configPlacement}
          @icon-change=${(e: CustomEvent) => { this._onIconChange(e); this._configPlacement = null; }}
          @cancel=${() => { this._configPlacement = null; }}
        ></fp-entity-config-dialog>
      ` : nothing}

      ${this.viewMode === 'edit' && this.drawTool === 'entity' && this.hass ? html`
        <fp-add-entity-dialog
          .hass=${this.hass}
          @add-entity=${this._onDialogAddEntity}
          @cancel=${this._onDialogCancel}
        ></fp-add-entity-dialog>
      ` : nothing}

      ${this._labelDialog ? html`
        <fp-label-dialog
          title=${this._labelDialog.mode === 'edit' ? 'Nom de la pièce' : 'Nommer la pièce'}
          value=${this._labelDialog.current ?? ''}
          placeholder="Optionnel…"
          @confirm=${this._onLabelConfirm}
          @cancel=${this._onLabelCancel}
        ></fp-label-dialog>
      ` : nothing}
    `;
  }
}
