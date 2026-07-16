"""Shared validation helpers for replay artifact boundaries."""

from __future__ import annotations

import re

_FULL_GIT_SHA = re.compile(r"[0-9a-fA-F]{40}")


def is_full_git_sha(value: object) -> bool:
    """Return whether ``value`` is a full hexadecimal Git object ID."""

    return isinstance(value, str) and _FULL_GIT_SHA.fullmatch(value) is not None
