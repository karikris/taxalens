from __future__ import annotations

from pathlib import Path

import polars as pl
import pytest

from packages.replay.src import biominer_storage_parquet as parquet_module
from packages.replay.src.biominer_storage_parquet import (
    BUCKET_VIEW_FILES,
    DEFAULT_PARQUET_COMPRESSION,
    ParquetRowSource,
    iter_parquet_batches,
    write_bucket_views,
    write_parquet,
    write_parquet_batches,
    write_parquet_part,
)


def test_write_parquet_round_trips_zstd_and_creates_parent(tmp_path: Path) -> None:
    frame = pl.DataFrame({"id": ["a", "b"], "value": [1, 2]})
    output = tmp_path / "nested" / "records.parquet"

    result = write_parquet(frame, output)

    assert result == output
    assert pl.read_parquet(output).equals(frame)
    assert DEFAULT_PARQUET_COMPRESSION == "zstd"
    assert list(output.parent.glob(f".{output.name}.*.tmp")) == []


def test_write_parquet_honours_overwrite_false(tmp_path: Path) -> None:
    output = write_parquet(pl.DataFrame({"id": [1]}), tmp_path / "records.parquet")

    with pytest.raises(FileExistsError):
        write_parquet(pl.DataFrame({"id": [2]}), output, overwrite=False)

    assert pl.read_parquet(output)["id"].to_list() == [1]


def test_write_failure_removes_temporary_output(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    output = tmp_path / "failed.parquet"

    def fail_write(*_args: object, **_kwargs: object) -> None:
        raise RuntimeError("write failed")

    monkeypatch.setattr(parquet_module, "_write_frame", fail_write)

    with pytest.raises(RuntimeError, match="write failed"):
        write_parquet(pl.DataFrame({"id": [1]}), output)

    assert not output.exists()
    assert list(tmp_path.glob(f".{output.name}.*.tmp")) == []


def test_batched_write_applies_schema_skips_empty_batches_and_iterates_bounded(
    tmp_path: Path,
) -> None:
    schema = {"id": pl.String, "value": pl.Int64, "note": pl.String}
    output = write_parquet_batches(
        [
            pl.DataFrame(schema=schema),
            pl.DataFrame({"id": ["a", "b"], "value": [1, 2]}),
            pl.DataFrame({"id": ["c"], "value": [3], "note": ["kept"]}),
        ],
        tmp_path / "batches.parquet",
        schema=schema,
    )

    restored = pl.read_parquet(output)
    batches = list(iter_parquet_batches(output, batch_size=2))

    assert restored.schema == pl.Schema(schema)
    assert restored.to_dicts() == [
        {"id": "a", "value": 1, "note": None},
        {"id": "b", "value": 2, "note": None},
        {"id": "c", "value": 3, "note": "kept"},
    ]
    assert [batch.height for batch in batches] == [2, 1]
    assert list(ParquetRowSource(output, batch_size=2)) == restored.to_dicts()


def test_batched_write_materializes_empty_schema(tmp_path: Path) -> None:
    schema = {"id": pl.String, "value": pl.Int64}
    output = write_parquet_batches([], tmp_path / "empty.parquet", schema=schema)

    restored = pl.read_parquet(output)
    assert restored.is_empty()
    assert restored.schema == pl.Schema(schema)


def test_iter_parquet_batches_requires_positive_batch_size(tmp_path: Path) -> None:
    output = write_parquet(pl.DataFrame({"id": [1]}), tmp_path / "records.parquet")

    with pytest.raises(ValueError, match="positive"):
        list(iter_parquet_batches(output, batch_size=0))


def test_write_parquet_part_reports_durable_metadata(tmp_path: Path) -> None:
    frame = pl.DataFrame({"id": [1, 2, 3]})
    result = write_parquet_part(frame, tmp_path / "part.parquet")

    assert result.uri == str(tmp_path / "part.parquet")
    assert result.row_count == 3
    assert result.byte_count is not None and result.byte_count > 0
    assert result.compression == "zstd"


def test_bucket_views_write_every_closed_bucket_without_fabricating_rows(
    tmp_path: Path,
) -> None:
    frame = pl.DataFrame(
        {
            "occurrence_bin": ["gold", "silver", "bronze", "bin", "in_review"],
            "id": [1, 2, 3, 4, 5],
        }
    )

    outputs = write_bucket_views(frame, tmp_path / "views")

    assert outputs == {
        bucket: str(tmp_path / "views" / filename)
        for bucket, filename in BUCKET_VIEW_FILES.items()
    }
    assert {
        bucket: pl.read_parquet(path)["id"].to_list()
        for bucket, path in outputs.items()
    } == {"gold": [1], "silver": [2], "bronze": [3], "bin": [4]}


def test_bucket_views_without_bucket_column_write_empty_files(tmp_path: Path) -> None:
    outputs = write_bucket_views(pl.DataFrame({"id": [1]}), tmp_path / "views")

    assert all(pl.read_parquet(path).is_empty() for path in outputs.values())
