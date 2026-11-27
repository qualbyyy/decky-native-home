"""Read-only TabMaster settings reader for Native Home's Custom Library."""
from __future__ import annotations

import os
from typing import Any

from nativehome.store_lookup import RegistryCache


class TabMasterReader:
    """Reads per-user TabMaster tabs, tag overrides, and friends' games with mtime caching."""

    def __init__(self, path: str) -> None:
        self._path = path
        self._cache = RegistryCache(path)

    def read_user_config(self, user_id: str) -> dict[str, Any] | None:
        if not os.path.isfile(self._path):
            return None
        data = self._cache.get()
        if not isinstance(data, dict) or not data:
            return None
        users = data.get("usersDict")
        if not isinstance(users, dict):
            return None
        uid = user_id.strip()
        if not uid:
            return {"available": True, "tabs": {}, "tagOverrides": {}, "friendsGames": {}}
        entry = users.get(uid)
        if not isinstance(entry, dict):
            return {"available": True, "tabs": {}, "tagOverrides": {}, "friendsGames": {}}
        tabs = entry.get("tabs")
        tag_overrides = entry.get("tag_overrides")
        friends_games = entry.get("friendsGames")
        return {
            "available": True,
            "tabs": tabs if isinstance(tabs, dict) else {},
            "tagOverrides": tag_overrides if isinstance(tag_overrides, dict) else {},
            "friendsGames": friends_games if isinstance(friends_games, dict) else {},
        }
