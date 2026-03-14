# Changelog

All notable changes to CartoForge will be documented here.

---

## [0.1.0] - 2026-03-14

### Added
- Interactive SVG canvas: draw walls (polyline/polygon), rooms (rectangle), erase elements
- Place Home Assistant entities on the map via a search modal
- Entity interactions: click to toggle (view mode), long press for more-info dialog, drag to move
- Long press on rooms/polygons in edit mode opens label dialog
- Rubber-band multi-selection for both drawing elements and entities
- Group drag: move mixed selections (drawing elements + entities) together
- Zoom (Ctrl+scroll, pinch) and pan
- Lovelace card `custom:carto-forge-card` with `map_id` or `map_ids[]` (tabbed multi-floor)
- Floating drawing toolbar with MDI icons and configurable keyboard shortcuts (V/W/R/E/P)
- CartoForge settings dialog: toggle shortcuts on/off, customize each key
- Per-map settings: name, background color, dimensions
- AGPL-3.0 license
