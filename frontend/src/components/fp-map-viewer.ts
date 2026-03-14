import { LitElement, html, css, svg, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import './fp-entity-icon';
import './fp-entity-config-dialog';
import './fp-map-editor';
import './fp-draw-toolbar';
import type {
  FloorMap, PlacedEntity, ViewMode, DrawTool,
  DrawingElement, WallElement, RoomElement, PolygonElement,
} from '../types/floorplan';
import type { Hass } from '../utils/ha-api';
import { toggleEntity } from '../utils/ha-api';

const FO_HALF = 28;
const SNAP = 10;
const snap = (v: number) => Math.round(v / SNAP) * SNAP;
const ZOOM_MIN = 0.2;
const ZOOM_MAX = 8;
// Minimum movement (SVG units) before a press becomes a drag
const DRAG_THRESHOLD = 8;

// ---------------------------------------------------------------------------
// Helpers purs — déplacement et intersection d'éléments
// ---------------------------------------------------------------------------
function moveElement(el: DrawingElement, dx: number, dy: number): DrawingElement {
  if (el.type === 'wall' || el.type === 'polygon') {
    return { ...el, points: el.points.map((p) => ({ x: p.x + dx, y: p.y + dy })) };
  }
  return { ...el, x: el.x + dx, y: el.y + dy };
}

function elementIntersectsRect(
  el: DrawingElement,
  rb: { x: number; y: number; w: number; h: number }
): boolean {
  const r = rb.x + rb.w, b = rb.y + rb.h;
  if (el.type === 'room') {
    return el.x < r && el.x + el.width > rb.x && el.y < b && el.y + el.height > rb.y;
  }
  return el.points.some((p) => p.x >= rb.x && p.x <= r && p.y >= rb.y && p.y <= b);
}

@customElement('fp-map-viewer')
export class FpMapViewer extends LitElement {
  @property({ attribute: false }) map?: FloorMap;
  @property({ attribute: false }) hass?: Hass;
  @property() viewMode: ViewMode = 'view';
  @property() drawTool: DrawTool = 'select';

  // Modale config entité (édition)
  @state() private _configPlacement: PlacedEntity | null = null;

  // ---- Sélection & déplacement d'éléments dessinés ----
  @state() private _selectedIds = new Set<string>();
  @state() private _dragOffset: { dx: number; dy: number } | null = null;
  @state() private _rubberBand: { x: number; y: number; w: number; h: number } | null = null;
  // Non-@state : ne déclenche pas de re-render pendant le geste
  private _elemDragStart: { x: number; y: number } | null = null;
  private _elemDragStarted = false;
  private _rubberBandStart: { x: number; y: number } | null = null;

  // ---- Drag entités (DOM direct) ----
  private _dragId: string | null = null;
  private _dragFO: SVGForeignObjectElement | null = null;
  private _dragOriginSvg: { x: number; y: number } | null = null;
  private _dragOriginPlacement: { x: number; y: number } | null = null;
  private _rafId: number | null = null;

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
    fp-map-editor { flex-shrink: 0; }
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
      this._dragOffset = { dx, dy };
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
        this._emitMapUpdate({ ...this.map, drawing });
      }
      this._elemDragStart = null;
      this._elemDragStarted = false;
      this._dragOffset = null;
      return;
    }

    // Fin rubber-band → sélectionne les éléments dans le rect
    if (this._rubberBandStart) {
      if (this._rubberBand && (this._rubberBand.w > 4 || this._rubberBand.h > 4)) {
        const rb = this._rubberBand;
        this._selectedIds = new Set(
          this.map?.drawing.filter((el) => elementIntersectsRect(el, rb)).map((el) => el.id) ?? []
        );
      } else {
        // Simple clic sur fond → désélectionne tout
        this._selectedIds = new Set();
      }
      this._rubberBand = null;
      this._rubberBandStart = null;
    }
  };

  // -------------------------------------------------------------------------
  // Éléments dessinés — sélection + drag
  // -------------------------------------------------------------------------
  private _onElementPointerDown(e: PointerEvent, el: DrawingElement): void {
    if (this.drawTool !== 'select') return;
    e.stopPropagation(); // empêche le rubber-band de démarrer

    if (e.shiftKey) {
      const next = new Set(this._selectedIds);
      next.has(el.id) ? next.delete(el.id) : next.add(el.id);
      this._selectedIds = next;
    } else if (!this._selectedIds.has(el.id)) {
      this._selectedIds = new Set([el.id]);
    }

    // Route les pointermove/up suivants vers le wrapper
    const wrapper = this.shadowRoot!.querySelector('.svg-wrapper') as HTMLElement;
    wrapper?.setPointerCapture(e.pointerId);

    this._elemDragStart = this._toSvg(e);
    this._elemDragStarted = false;
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

  // -------------------------------------------------------------------------
  // Drag entités — manipulation DOM directe, zéro re-render pendant le mouvement
  // -------------------------------------------------------------------------
  private _onDragStart = (e: CustomEvent): void => {
    const { placementId, clientX, clientY } = e.detail;
    const placement = this.map?.entities.find((en) => en.placementId === placementId);
    if (!placement) return;
    this._dragId = placementId;
    this._dragOriginSvg = this._toSvg({ clientX, clientY });
    this._dragOriginPlacement = { x: placement.x, y: placement.y };
    this._dragFO = this.shadowRoot?.querySelector(
      `foreignObject[data-pid="${placementId}"]`
    ) as SVGForeignObjectElement | null;
  };

  private _onDragMove = (e: CustomEvent): void => {
    if (!this._dragFO || !this._dragOriginSvg || !this._dragOriginPlacement) return;
    const cur = this._toSvg(e.detail);
    const x = this._dragOriginPlacement.x + cur.x - this._dragOriginSvg.x;
    const y = this._dragOriginPlacement.y + cur.y - this._dragOriginSvg.y;
    // rAF throttle: never queue more than one frame
    if (this._rafId !== null) cancelAnimationFrame(this._rafId);
    this._rafId = requestAnimationFrame(() => {
      this._rafId = null;
      this._dragFO?.setAttribute('x', String(x - FO_HALF));
      this._dragFO?.setAttribute('y', String(y - FO_HALF));
    });
  };

  private _onDragEnd = (e: CustomEvent): void => {
    if (this._rafId !== null) { cancelAnimationFrame(this._rafId); this._rafId = null; }
    if (!this.map || !this._dragId || !this._dragOriginSvg || !this._dragOriginPlacement) return;
    const cur = this._toSvg(e.detail);
    const x = snap(this._dragOriginPlacement.x + cur.x - this._dragOriginSvg.x);
    const y = snap(this._dragOriginPlacement.y + cur.y - this._dragOriginSvg.y);
    const entities = this.map.entities.map((en) =>
      en.placementId === this._dragId ? { ...en, x, y } : en
    );
    this._emitMapUpdate({ ...this.map, entities });
    this._dragId = null;
    this._dragFO = null;
    this._dragOriginSvg = null;
    this._dragOriginPlacement = null;
  };

  // -------------------------------------------------------------------------
  // Ajout d'entité
  // -------------------------------------------------------------------------
  private _onAddEntity = (e: CustomEvent): void => {
    if (!this.map) return;
    const icons: Record<string, string> = {
      light: 'mdi:ceiling-light', switch: 'mdi:power-socket',
      sensor: 'mdi:thermometer', binary_sensor: 'mdi:motion-sensor',
      media_player: 'mdi:television', climate: 'mdi:thermostat',
      cover: 'mdi:window-shutter',
    };
    const newEntity: PlacedEntity = {
      placementId: crypto.randomUUID(),
      entityId: e.detail.entityId,
      x: e.detail.x, y: e.detail.y,
      icon: icons[e.detail.entityId.split('.')[0]] ?? 'mdi:help-circle',
    };
    this._emitMapUpdate({ ...this.map, entities: [...this.map.entities, newEntity] });
  };

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
      const label = prompt('Nom de la pièce (optionnel)') ?? '';
      const el: RoomElement = {
        id: crypto.randomUUID(), type: 'room',
        x: this._roomDraft.x, y: this._roomDraft.y,
        width: this._roomDraft.w, height: this._roomDraft.h,
        ...(label ? { label } : {}),
      };
      this._emitMapUpdate({ ...this.map, drawing: [...this.map.drawing, el] });
    }
    this._roomDraft = null;
    this._roomStart = null;
  }

  private _closeWallAsPolygon(): void {
    if (!this.map) return;
    const label = prompt('Nom de la pièce (optionnel)') ?? '';
    const el: PolygonElement = {
      id: crypto.randomUUID(), type: 'polygon',
      points: [...this._wallPoints],
      ...(label ? { label } : {}),
    };
    this._emitMapUpdate({ ...this.map, drawing: [...this.map.drawing, el] });
    this._wallPoints = [];
    this._preview = null;
  }

  private _editElementLabel(e: Event, elementId: string, currentLabel?: string): void {
    if (this.viewMode !== 'edit' || this.drawTool !== 'select') return;
    e.stopPropagation();
    const label = prompt('Nom de la pièce', currentLabel ?? '');
    if (label === null) return;
    this._emitMapUpdate({
      ...this.map!,
      drawing: this.map!.drawing.map((d) =>
        d.id === elementId ? { ...d, label: label || undefined } : d
      ),
    });
  }

  private _onSvgDblClick(): void {
    if (!this.map || this.drawTool !== 'wall' || this._wallPoints.length < 2) return;
    const el: WallElement = { id: crypto.randomUUID(), type: 'wall', points: [...this._wallPoints] };
    this._emitMapUpdate({ ...this.map, drawing: [...this.map.drawing, el] });
    this._wallPoints = [];
    this._preview = null;
  }

  private _onEscape = (e: KeyboardEvent): void => {
    if (e.key !== 'Escape') return;
    this._wallPoints = [];
    this._preview = null;
    this._roomDraft = null;
    this._roomStart = null;
    this._selectedIds = new Set(); // Escape désélectionne aussi
  };

  private _eraseElement(id: string): void {
    if (!this.map || this.drawTool !== 'eraser') return;
    this._emitMapUpdate({ ...this.map, drawing: this.map.drawing.filter((el) => el.id !== id) });
  }

  private _emitMapUpdate(map: FloorMap): void {
    this.dispatchEvent(new CustomEvent('map-updated', { detail: map, bubbles: true, composed: true }));
  }

  connectedCallback(): void {
    super.connectedCallback();
    window.addEventListener('keydown', this._onEscape);
    this.addEventListener('wheel', this._onWheel, { passive: false });
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    window.removeEventListener('keydown', this._onEscape);
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
    const selCount = this._selectedIds.size;

    return html`
      ${this.viewMode === 'edit'
        ? html`<fp-draw-toolbar .activeTool=${this.drawTool}
            @tool-change=${(e: CustomEvent<DrawTool>) => {
              this._selectedIds = new Set();
              this.dispatchEvent(new CustomEvent('tool-change', { detail: e.detail, bubbles: true, composed: true }));
            }}
          ></fp-draw-toolbar>`
        : nothing}

      <div class="svg-wrapper"
        @fp-click=${this._onEntityClick}
        @fp-entity-config=${this._onEntityConfig}
        @icon-change=${this._onIconChange}
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
          ${entities.map((placed: PlacedEntity) => svg`
            <foreignObject
              data-pid="${placed.placementId}"
              x="${placed.x - FO_HALF}" y="${placed.y - FO_HALF}"
              width="${FO_HALF * 2}" height="${FO_HALF * 2}"
              overflow="visible"
            >
              <fp-entity-icon
                xmlns="http://www.w3.org/1999/xhtml"
                .placement=${placed}
                .entityState=${this.hass?.states[placed.entityId]}
                .viewMode=${this.viewMode}
              ></fp-entity-icon>
            </foreignObject>
          `)}

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

      ${this.viewMode === 'edit' && this.drawTool === 'select' && this.hass
        ? html`<fp-map-editor .map=${this.map} .hass=${this.hass}
            @add-entity=${this._onAddEntity}></fp-map-editor>`
        : nothing}
    `;
  }
}
