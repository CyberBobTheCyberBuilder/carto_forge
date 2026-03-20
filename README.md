# CartoForge

[![HACS Custom](https://img.shields.io/badge/HACS-Custom-41BDF5.svg)](https://github.com/hacs/integration)
[![License: AGPL-3.0](https://img.shields.io/badge/License-AGPL--3.0-blue.svg)](LICENSE)

Copyright (C) 2026 Bob — Licensed under the [GNU AGPL-3.0](LICENSE)

A Home Assistant custom component to create and manage interactive floor plans — rooms, walls, zones — with entity placement and real-time control.

---

## Installation

### Via HACS (recommended)

1. Open HACS in Home Assistant
2. Click **⋮ → Custom repositories**
3. Add `https://github.com/CyberBobTheCyberBuilder/carto_forge` — category **Integration**
4. Search for **CartoForge** and click **Download**
5. Restart Home Assistant

Then add to `configuration.yaml`:

```yaml
carto_forge:
```

That's it — the sidebar panel and Lovelace resource are registered automatically.

### Manual

```bash
git clone https://github.com/CyberBobTheCyberBuilder/carto_forge
cd carto_forge/frontend && npm install && npm run build
cp -r custom_components/carto_forge <your_ha_config>/custom_components/
```

Then add `carto_forge:` to `configuration.yaml` and restart Home Assistant.

---

## Features

- Draw floor plans with walls, rooms, and polygons
- Place and control Home Assistant entities on the map
- Multi-floor support via tabs in the Lovelace card
- Zoom, pan, and touch support (pinch-to-zoom)
- Per-map background color
- Live Docker development workflow

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
cd frontend
npm run dev      # local dev server with mock API → http://localhost:5173
npm run build    # production build → custom_components/carto_forge/www/
```

After Python changes: restart HA. After frontend changes: hard-refresh (Ctrl+F5).

---
