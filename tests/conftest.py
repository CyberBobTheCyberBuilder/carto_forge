"""Stub homeassistant modules pour permettre les tests sans HA installé."""
import sys
from unittest.mock import MagicMock

HA_MODULES = [
    "homeassistant",
    "homeassistant.core",
    "homeassistant.helpers",
    "homeassistant.helpers.storage",
    "homeassistant.components",
    "homeassistant.components.http",
    "homeassistant.config_entries",
    "aiohttp",
    "aiohttp.web",
]

for mod in HA_MODULES:
    sys.modules.setdefault(mod, MagicMock())
