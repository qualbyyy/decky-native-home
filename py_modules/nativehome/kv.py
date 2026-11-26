"""Small JSON-file key-value store with atomic writes."""
from __future__ import annotations

import json
import os
import tempfile
import threading
from typing import Any


class KvStore:
    def __init__(self, path: str) -> None:
        self._path = path
        self._lock = threading.Lock()
        self._data: dict[str, Any] | None = None

    def _load(self, *, strict: bool = False) -> dict[str, Any]:
        if self._data is None:
            try:
                with open(self._path, encoding="utf-8") as f:
                    data = json.load(f)
                self._data = data if isinstance(data, dict) else {}
            except FileNotFoundError:
                self._data = {}
            except OSError:
                if strict:
                    raise
                return {}
            except ValueError:
                return {}
        return self._data

    def _save(self, data: dict[str, Any]) -> None:
        directory = os.path.dirname(self._path) or "."
        os.makedirs(directory, exist_ok=True)
        fd, tmp = tempfile.mkstemp(dir=directory, prefix=".kv-", suffix=".tmp")
        try:
            with os.fdopen(fd, "w", encoding="utf-8") as f:
                json.dump(data, f)
                f.flush()
                os.fsync(f.fileno())
            os.replace(tmp, self._path)
        except BaseException:
            try:
                os.unlink(tmp)
            except OSError:
                pass
            raise

    def get(self, key: str) -> Any | None:
        with self._lock:
            return self._load().get(key)

    def set(self, key: str, value: Any) -> None:
        with self._lock:
            next_data = dict(self._load(strict=True))
            next_data[key] = value
            self._save(next_data)
            self._data = next_data

    def delete(self, key: str) -> None:
        with self._lock:
            data = self._load(strict=True)
            if key in data:
                next_data = dict(data)
                del next_data[key]
                self._save(next_data)
                self._data = next_data

    def delete_prefix(self, prefix: str) -> int:
        with self._lock:
            data = self._load(strict=True)
            keys = [k for k in data if k.startswith(prefix)]
            if keys:
                next_data = {k: v for k, v in data.items() if not k.startswith(prefix)}
                self._save(next_data)
                self._data = next_data
            return len(keys)
