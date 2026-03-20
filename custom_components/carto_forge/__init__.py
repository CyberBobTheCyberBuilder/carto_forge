"""CartoForge integration."""
from __future__ import annotations

import logging
import shutil
import uuid
from pathlib import Path

from homeassistant.components.panel_custom import async_register_panel
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant, ServiceCall
from homeassistant.helpers.storage import Store

from .const import DOMAIN
from .http import async_register_views
from .storage import FloorPlanStorage

_LOGGER = logging.getLogger(__name__)

FRONTEND_DIR = Path(__file__).parent / "www"
PANEL_JS_URL = "/local/carto_forge/carto-forge-panel.js"


def _copy_frontend(src_dir: Path, dst_dir: Path) -> None:
    dst_dir.mkdir(parents=True, exist_ok=True)
    for src in src_dir.iterdir():
        try:
            shutil.copy2(src, dst_dir / src.name)
        except shutil.SameFileError:
            pass


async def _ensure_lovelace_resource(hass: HomeAssistant, url: str) -> None:
    """Enregistre le JS comme ressource Lovelace (remplace toute entrée carto_forge existante)."""
    store = Store(hass, 1, "lovelace_resources")
    data = await store.async_load() or {"items": []}
    items: list[dict] = data.get("items", [])
    items = [i for i in items if "carto_forge" not in i.get("url", "")]
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
        dst = Path(hass.config.path("www", "carto_forge"))
        await hass.async_add_executor_job(_copy_frontend, FRONTEND_DIR, dst)
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
