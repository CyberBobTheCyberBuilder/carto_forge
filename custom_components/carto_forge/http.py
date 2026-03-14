"""HTTP views exposing the map config REST API."""
from __future__ import annotations

from aiohttp import web

from homeassistant.components.http import HomeAssistantView
from homeassistant.core import HomeAssistant

from .const import DOMAIN


async def async_register_views(hass: HomeAssistant) -> None:
    hass.http.register_view(CartoForgeMapsView)
    hass.http.register_view(CartoForgeMapDetailView)


class CartoForgeMapsView(HomeAssistantView):
    """GET  /api/carto_forge/maps  — liste toutes les cartes
       POST /api/carto_forge/maps  — crée une carte"""

    url = "/api/carto_forge/maps"
    name = "api:carto_forge:maps"
    requires_auth = True

    async def get(self, request: web.Request) -> web.Response:
        hass: HomeAssistant = request.app["hass"]
        storage = hass.data[DOMAIN]["storage"]
        maps = await storage.async_get_maps()
        return self.json(maps)

    async def post(self, request: web.Request) -> web.Response:
        hass: HomeAssistant = request.app["hass"]
        storage = hass.data[DOMAIN]["storage"]
        body = await request.json()
        created = await storage.async_create_map(body)
        return self.json(created, status_code=201)


class CartoForgeMapDetailView(HomeAssistantView):
    """GET / PUT / DELETE /api/carto_forge/maps/{map_id}"""

    url = "/api/carto_forge/maps/{map_id}"
    name = "api:carto_forge:map_detail"
    requires_auth = True

    async def get(self, request: web.Request, map_id: str) -> web.Response:
        hass: HomeAssistant = request.app["hass"]
        storage = hass.data[DOMAIN]["storage"]
        for m in await storage.async_get_maps():
            if m["id"] == map_id:
                return self.json(m)
        raise web.HTTPNotFound()

    async def put(self, request: web.Request, map_id: str) -> web.Response:
        hass: HomeAssistant = request.app["hass"]
        storage = hass.data[DOMAIN]["storage"]
        body = await request.json()
        updated = await storage.async_update_map(map_id, body)
        if updated is None:
            raise web.HTTPNotFound()
        return self.json(updated)

    async def delete(self, request: web.Request, map_id: str) -> web.Response:
        hass: HomeAssistant = request.app["hass"]
        storage = hass.data[DOMAIN]["storage"]
        deleted = await storage.async_delete_map(map_id)
        if not deleted:
            raise web.HTTPNotFound()
        return web.Response(status=204)
