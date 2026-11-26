import asyncio
import datetime
import os

import decky

from nativehome.heroic import HeroicLibrary, heroic_cache_dirs
from nativehome.home_errors import FILE_NAME, append_log, start_entry
from nativehome.kv import KvStore
from nativehome.migrate import carry_over, old_data_path
from nativehome.store_lookup import RegistryCache, key_for_appid, store_for_appid

DATA_PATH = os.path.join(decky.DECKY_PLUGIN_SETTINGS_DIR, "data.json")
if carry_over(old_data_path(decky.DECKY_PLUGIN_SETTINGS_DIR), DATA_PATH):
    decky.logger.info("[native-home] carried over data from Ally Game Page")
KV = KvStore(DATA_PATH)
REGISTRY = RegistryCache(
    os.path.join(decky.DECKY_USER_HOME, ".local", "share", "unifideck", "shortcuts_registry.json")
)

HEROIC = HeroicLibrary(heroic_cache_dirs(decky.DECKY_USER_HOME))


class Plugin:
    async def kv_get(self, key: str):
        if not isinstance(key, str) or not key:
            return None
        try:
            return KV.get(key)
        except Exception:
            decky.logger.exception("[native-home] kv_get failed")
            return None

    async def kv_set(self, key: str, value) -> None:
        if not isinstance(key, str) or not key:
            return
        try:
            await asyncio.to_thread(KV.set, key, value)
        except Exception:
            decky.logger.exception("[native-home] kv_set failed")

    async def kv_delete(self, key: str) -> None:
        if not isinstance(key, str) or not key:
            return
        try:
            await asyncio.to_thread(KV.delete, key)
        except Exception:
            decky.logger.exception("[native-home] kv_delete failed")

    async def kv_delete_prefix(self, prefix: str) -> int:
        if not isinstance(prefix, str) or not prefix:
            return 0
        try:
            return await asyncio.to_thread(KV.delete_prefix, prefix)
        except Exception:
            decky.logger.exception("[native-home] kv_delete_prefix failed")
            return 0

    async def get_store(self, appid: int):
        try:
            return store_for_appid(REGISTRY.get(), int(appid))
        except Exception:
            decky.logger.exception("[native-home] get_store failed")
            return None

    async def get_unifideck_key(self, appid: int):
        # {"store": "gog", "id": "1450711444"}: the key Unifideck's own backend takes (e.g. its get_playtime), or None.
        try:
            return key_for_appid(REGISTRY.get(), int(appid))
        except Exception:
            decky.logger.exception("[native-home] get_unifideck_key failed")
            return None

    async def get_heroic_description(self, runner: str, app_name: str):
        if not isinstance(runner, str) or not isinstance(app_name, str) or not runner.strip() or not app_name.strip():
            return None
        try:
            return HEROIC.description(runner, app_name)
        except Exception:
            decky.logger.exception("[native-home] get_heroic_description failed")
            return None

    async def log_home_error(self, entry: str) -> None:
        # Home recovered from an error (src/home/RouteGuard): kept in the plugin's own log for a bug report.
        if not isinstance(entry, str) or not entry.strip():
            return
        try:
            await asyncio.to_thread(append_log, decky.DECKY_PLUGIN_LOG_DIR, f"v{decky.DECKY_PLUGIN_VERSION} {entry}"[:8000])
        except Exception:
            decky.logger.exception("[native-home] log_home_error failed")

    async def get_version(self):
        # The installed version, from package.json at install time (Decky's environment); the updater compares it.
        return decky.DECKY_PLUGIN_VERSION

    async def _main(self):
        decky.logger.info("[native-home] backend started")
        # Our own log records each start-up and where it is, so a report can show the location without an error.
        try:
            now = datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.000Z")
            path = os.path.join(decky.DECKY_PLUGIN_LOG_DIR, FILE_NAME)
            append_log(decky.DECKY_PLUGIN_LOG_DIR, start_entry(decky.DECKY_PLUGIN_VERSION, now, path))
        except Exception:
            decky.logger.exception("[native-home] start-up log entry failed")

    async def _unload(self):
        decky.logger.info("[native-home] backend stopped")
