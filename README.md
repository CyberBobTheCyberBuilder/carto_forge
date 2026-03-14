# CartoForge

Copyright (C) 2026 Bob — Licensed under the [GNU AGPL-3.0](LICENSE)

A Home Assistant custom component to create and manage interactive floor plans — rooms, walls, zones — with entity placement and real-time control.

---

## Features

- Draw floor plans with walls, rooms, and polygons
- Place and control Home Assistant entities on the map
- Multi-floor support via tabs in the Lovelace card
- Zoom, pan, and touch support (pinch-to-zoom)
- Per-map background color
- Live Docker development workflow

---

## Installation

### Requirements

- Home Assistant (Docker or supervised)
- Node.js 18+

### Setup

```bash
cd frontend
npm install
npm run build
```

Add to `configuration.yaml`:

```yaml
carto_forge:

panel_custom:
  - name: carto-forge-panel
    sidebar_title: CartoForge
    sidebar_icon: mdi:floor-plan
    url_path: cartoforge
    module_url: /local/carto_forge/carto-forge-panel.js
```

### Lovelace Resource

In HA → **Settings** → **Dashboards** → **Resources** → Add:

| URL | Type |
|-----|------|
| `/local/carto_forge/carto-forge-panel.js` | JavaScript Module |

### Docker (live reload)

```bash
docker compose -f ~/ha-dev/docker-compose.yml up -d
cd frontend && npm run watch
```

After Python changes: restart the container. After frontend changes: hard-refresh the browser (Ctrl+F5).

---

## Lovelace Card

```yaml
type: custom:carto-forge-card
map_id: your-map-id       # single floor
height: 400               # optional, default 400px
```

```yaml
type: custom:carto-forge-card
map_ids:                  # multiple floors → tab bar
  - floor-1-id
  - floor-2-id
height: 500
```

---

## Keyboard Shortcuts & Interactions

### Canvas Navigation

| Action | Result |
|--------|--------|
| `Ctrl` + scroll wheel | Zoom in/out (centered on cursor) |
| Drag on empty background (view mode) | Pan |
| Pinch gesture (touch) | Zoom in/out |

### Drawing Tools (edit mode)

| Tool | Action | Result |
|------|--------|--------|
| **Wall** | Click | Add point |
| **Wall** | Double-click | End wall (open polyline) |
| **Wall** | Click on first point | Close wall as polygon |
| **Wall** | `Escape` | Cancel current wall |
| **Room** | Drag | Draw rectangle |
| **Eraser** | Click on element | Delete element |

### Select Tool (edit mode)

| Action | Result |
|--------|--------|
| Click on element | Select it (deselects others) |
| `Shift` + click on element | Add/remove from selection |
| Drag on empty area | Rubber-band multi-select |
| Drag on selected element | Move all selected elements |
| `Escape` | Clear selection |

> A badge at the bottom of the canvas shows the number of selected elements.

### Entities

| Mode | Action | Result |
|------|--------|--------|
| View | Click | Toggle entity (on/off) |
| View | Long press (600 ms) | Open native HA more-info dialog |
| Edit | Drag | Move entity |
| Edit | Long press (600 ms) | Open entity config (icon picker + delete) |

---

## Development

```bash
npm run dev      # local dev server with mock API → http://localhost:5173
npm run build    # production build → custom_components/carto_forge/www/
npm run watch    # watch mode (used by dev.sh)
```

---

## Roadmap

- [ ] Entity z-index reordering
- [ ] Two-finger pan on mobile
- [ ] Internationalization (i18n)
- [ ] HACS publication
