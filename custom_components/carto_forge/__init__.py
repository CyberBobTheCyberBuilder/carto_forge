"""CartoForge integration."""
from __future__ import annotations

import logging
import shutil
from pathlib import Path

from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant

from .const import DOMAIN
from .http import async_register_views
from .storage import FloorPlanStorage

_LOGGER = logging.getLogger(__name__)

FRONTEND_DIR = Path(__file__).parent / "www"


async def async_setup(hass: HomeAssistant, config: dict) -> bool:
    """Initialisation depuis configuration.yaml."""
    _LOGGER.debug("Setting up %s", DOMAIN)

    storage = FloorPlanStorage(hass)
    await storage.async_load()
    hass.data[DOMAIN] = {"storage": storage}

    # Copie les fichiers frontend dans <config>/www/carto_forge/
    # (servi nativement par HA sous /local/carto_forge/)
    dst_dir = Path(hass.config.path("www", "carto_forge"))
    if FRONTEND_DIR.exists():
        dst_dir.mkdir(parents=True, exist_ok=True)
        for src_file in FRONTEND_DIR.iterdir():
            shutil.copy2(src_file, dst_dir / src_file.name)
        _LOGGER.debug("Frontend files copied to %s", dst_dir)
    else:
        _LOGGER.warning("CartoForge www/ directory not found at %s", FRONTEND_DIR)

    await async_register_views(hass)

    _LOGGER.info("%s setup complete", DOMAIN)
    return True


async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    return True


async def async_unload_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    return True
