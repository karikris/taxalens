from __future__ import annotations

from packages.replay.src.validation import is_full_git_sha


def test_is_full_git_sha_accepts_full_hexadecimal_ids() -> None:
    assert is_full_git_sha("1535c494f9403e22ed9b163f3ae0ce3706e17f4c")
    assert is_full_git_sha("1535C494F9403E22ED9B163F3AE0CE3706E17F4C")


def test_is_full_git_sha_rejects_invalid_values() -> None:
    assert not is_full_git_sha("short-sha")
    assert not is_full_git_sha("z" * 40)
    assert not is_full_git_sha("a" * 39)
    assert not is_full_git_sha("a" * 41)
    assert not is_full_git_sha(b"a" * 40)
    assert not is_full_git_sha(None)
