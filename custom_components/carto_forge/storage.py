"""Persistent storage for floor plan map configurations."""
from __future__ import annotations

import uuid
from typing import Any

from homeassistant.core import HomeAssistant
from homeassistant.helpers.storage import Store

from .const import STORAGE_KEY, STORAGE_VERSION


class FloorPlanStorage:
    """Wraps HA's Store helper to persist map configs as JSON."""

    def __init__(self, hass: HomeAssistant) -> None:
        self._store: Store = Store(hass, STORAGE_VERSION, STORAGE_KEY)
        self._data: dict[str, Any] = {"maps": []}

    async def async_load(self) -> None:
        """Load data from storage on startup."""
        stored = await self._store.async_load()
        if stored is not None:
            self._data = stored

    @property
    def maps(self) -> list[dict]:
        return self._data.get("maps", [])

    async def async_save(self) -> None:
        await self._store.async_save(self._data)

    async def async_get_maps(self) -> list[dict]:
        return self.maps

    async def async_create_map(self, map_data: dict) -> dict:
        map_data["id"] = str(uuid.uuid4())
        self._data["maps"].append(map_data)
        await self.async_save()
        return map_data

    async def async_update_map(self, map_id: str, map_data: dict) -> dict | None:
        for i, m in enumerate(self._data["maps"]):
            if m["id"] == map_id:
                # id is always taken from the URL, not the body, to prevent spoofing
                self._data["maps"][i] = {**m, **map_data, "id": map_id}
                await self.async_save()
                return self._data["maps"][i]
        return None

    async def async_delete_map(self, map_id: str) -> bool:
        # Compare lengths to detect whether anything was actually removed
        before = len(self._data["maps"])
        self._data["maps"] = [m for m in self._data["maps"] if m["id"] != map_id]
        if len(self._data["maps"]) < before:
            await self.async_save()
            return True
        return False
