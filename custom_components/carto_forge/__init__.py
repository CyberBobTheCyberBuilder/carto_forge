"""CartoForge integration."""
from __future__ import annotations

import logging
import uuid
from pathlib import Path

from homeassistant.components.http import StaticPathConfig
from homeassistant.components.panel_custom import async_register_panel
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant, ServiceCall
from homeassistant.helpers.storage import Store

from .const import DOMAIN
from .http import async_register_views
from .storage import FloorPlanStorage

_LOGGER = logging.getLogger(__name__)

FRONTEND_DIR = Path(__file__).parent / "www"
STATIC_URL = "/carto_forge"
PANEL_JS_URL = f"{STATIC_URL}/carto-forge-panel.js"


async def _ensure_lovelace_resource(hass: HomeAssistant, url: str) -> None:
    """Ajoute le JS comme ressource Lovelace si absent ou mal formé."""
    store = Store(hass, 1, "lovelace_resources")
    data = await store.async_load() or {"items": []}
    items: list[dict] = data.get("items", [])
    items = [i for i in items if i.get("url") != url]
    items.append({"id": uuid.uuid4().hex, "url": url, "type": "module"})
    await store.async_save({"items": items})
    _LOGGER.info("CartoForge: ressource Lovelace enregistrée → %s", url)


async def async_setup(hass: HomeAssistant, config: dict) -> bool:
    """Initialisation depuis configuration.yaml."""
    _LOGGER.debug("Setting up %s", DOMAIN)

    storage = FloorPlanStorage(hass)
    await storage.async_load()
    hass.data[DOMAIN] = {"storage": storage}

    await async_register_views(hass)

    if FRONTEND_DIR.exists():
        await hass.http.async_register_static_paths(
            [StaticPathConfig(STATIC_URL, str(FRONTEND_DIR), cache_headers=False)]
        )
    else:
        _LOGGER.warning("CartoForge www/ directory not found at %s", FRONTEND_DIR)

    try:
        await async_register_panel(
            hass,
            webcomponent_name="carto-forge-panel",
            frontend_url_path="cartoforge",
            sidebar_title="CartoForge",
            sidebar_icon="mdi:floor-plan",
            module_url=PANEL_JS_URL,
            require_admin=False,
        )
    except ValueError:
        _LOGGER.debug("Panel cartoforge déjà enregistré")

    await _ensure_lovelace_resource(hass, PANEL_JS_URL)

    async def handle_reload(call: ServiceCall) -> None:
        """Recharge le storage sans redémarrer HA."""
        await hass.data[DOMAIN]["storage"].async_load()
        _LOGGER.info("CartoForge reloaded")

    hass.services.async_register(DOMAIN, "reload", handle_reload)

    _LOGGER.info("%s setup complete", DOMAIN)
    return True


async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    return True


async def async_unload_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    return True
