"""CartoForge integration."""
from __future__ import annotations

import logging
import shutil
from pathlib import Path

from homeassistant.config_entries import ConfigEntry
from homeassistant.components.frontend import add_extra_js_url
from homeassistant.components.panel_custom import async_register_panel
from homeassistant.core import HomeAssistant, ServiceCall

from .const import DOMAIN
from .http import async_register_views
from .storage import FloorPlanStorage

_LOGGER = logging.getLogger(__name__)

FRONTEND_DIR = Path(__file__).parent / "www"
PANEL_JS_URL = "/local/carto_forge/carto-forge-panel.js"


def _copy_frontend(hass: HomeAssistant) -> None:
    dst_dir = Path(hass.config.path("www", "carto_forge"))
    if FRONTEND_DIR.exists():
        dst_dir.mkdir(parents=True, exist_ok=True)
        for src_file in FRONTEND_DIR.iterdir():
            try:
                shutil.copy2(src_file, dst_dir / src_file.name)
            except shutil.SameFileError:
                pass
        _LOGGER.debug("Frontend files copied to %s", dst_dir)
    else:
        _LOGGER.warning("CartoForge www/ directory not found at %s", FRONTEND_DIR)


async def async_setup(hass: HomeAssistant, config: dict) -> bool:
    """Initialisation depuis configuration.yaml."""
    _LOGGER.debug("Setting up %s", DOMAIN)

    storage = FloorPlanStorage(hass)
    await storage.async_load()
    hass.data[DOMAIN] = {"storage": storage}

    _copy_frontend(hass)
    await async_register_views(hass)

    # Panneau sidebar — remplace le bloc panel_custom: dans configuration.yaml
    await async_register_panel(
        hass,
        webcomponent_name="carto-forge-panel",
        frontend_url_path="cartoforge",
        sidebar_title="CartoForge",
        sidebar_icon="mdi:floor-plan",
        module_url=PANEL_JS_URL,
        require_admin=False,
    )

    # Ressource JS globale — remplace l'ajout manuel dans Paramètres → Tableaux de bord → Ressources
    add_extra_js_url(hass, PANEL_JS_URL)

    async def handle_reload(call: ServiceCall) -> None:
        """Recharge le frontend et le storage sans redémarrer HA."""
        _copy_frontend(hass)
        await hass.data[DOMAIN]["storage"].async_load()
        _LOGGER.info("CartoForge reloaded")

    hass.services.async_register(DOMAIN, "reload", handle_reload)

    _LOGGER.info("%s setup complete", DOMAIN)
    return True


async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    return True


async def async_unload_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    return True
