"""Tests unitaires pour FloorPlanStorage."""
import pytest
from unittest.mock import AsyncMock, MagicMock, patch


def make_storage():
    """Crée un FloorPlanStorage avec un Store mocké."""
    from custom_components.carto_forge.storage import FloorPlanStorage

    hass = MagicMock()
    store_mock = AsyncMock()
    store_mock.async_load = AsyncMock(return_value=None)
    store_mock.async_save = AsyncMock()

    with patch("custom_components.carto_forge.storage.Store", return_value=store_mock):
        storage = FloorPlanStorage(hass)
        storage._store = store_mock

    return storage


@pytest.mark.asyncio
async def test_load_empty():
    storage = make_storage()
    storage._store.async_load = AsyncMock(return_value=None)
    await storage.async_load()
    assert storage.maps == []


@pytest.mark.asyncio
async def test_load_existing_data():
    storage = make_storage()
    existing = {"maps": [{"id": "abc", "name": "Salon", "width": 800, "height": 600}]}
    storage._store.async_load = AsyncMock(return_value=existing)
    await storage.async_load()
    assert len(storage.maps) == 1
    assert storage.maps[0]["name"] == "Salon"


@pytest.mark.asyncio
async def test_create_map():
    storage = make_storage()
    data = {"name": "Cuisine", "width": 400, "height": 300, "drawing": [], "entities": []}
    result = await storage.async_create_map(data)
    assert "id" in result
    assert result["name"] == "Cuisine"
    assert len(storage.maps) == 1
    storage._store.async_save.assert_called_once()


@pytest.mark.asyncio
async def test_create_map_generates_unique_ids():
    storage = make_storage()
    a = await storage.async_create_map({"name": "A", "width": 100, "height": 100})
    b = await storage.async_create_map({"name": "B", "width": 100, "height": 100})
    assert a["id"] != b["id"]


@pytest.mark.asyncio
async def test_update_map():
    storage = make_storage()
    created = await storage.async_create_map({"name": "Avant", "width": 100, "height": 100})
    map_id = created["id"]

    updated = await storage.async_update_map(map_id, {"name": "Après", "width": 200, "height": 200})
    assert updated is not None
    assert updated["name"] == "Après"
    assert updated["width"] == 200
    assert updated["id"] == map_id  # l'id ne change jamais


@pytest.mark.asyncio
async def test_update_map_not_found():
    storage = make_storage()
    result = await storage.async_update_map("inexistant", {"name": "X"})
    assert result is None


@pytest.mark.asyncio
async def test_delete_map():
    storage = make_storage()
    created = await storage.async_create_map({"name": "À supprimer", "width": 100, "height": 100})
    map_id = created["id"]

    deleted = await storage.async_delete_map(map_id)
    assert deleted is True
    assert len(storage.maps) == 0


@pytest.mark.asyncio
async def test_delete_map_not_found():
    storage = make_storage()
    result = await storage.async_delete_map("inexistant")
    assert result is False


@pytest.mark.asyncio
async def test_update_cannot_change_id():
    """L'id dans le body est ignoré — c'est celui de l'URL qui prime."""
    storage = make_storage()
    created = await storage.async_create_map({"name": "Test", "width": 100, "height": 100})
    original_id = created["id"]

    updated = await storage.async_update_map(original_id, {"id": "tentative-spoofing", "name": "Test"})
    assert updated is not None
    assert updated["id"] == original_id
