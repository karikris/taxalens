#!/usr/bin/env python3
"""Independently verify committed Geographic Impact artifacts with DuckDB."""

from __future__ import annotations

import argparse
import hashlib
import json
import sys
from pathlib import Path

_REPOSITORY_ROOT = Path(__file__).resolve().parents[1]
if str(_REPOSITORY_ROOT) not in sys.path:
    sys.path.insert(0, str(_REPOSITORY_ROOT))

import duckdb  # noqa: E402
from packages.replay.src.geographic_impact_materializer import (  # noqa: E402
    DEFAULT_BASELINE_UNION,
    DEFAULT_FLICKR_GEOGRAPHY,
    REPOSITORY_ROOT,
)
from packages.replay.src.occurrence_release import (  # noqa: E402
    DEFAULT_RELEASE_DECISIONS,
)
from scripts.build_geographic_impact import (  # noqa: E402
    OUTPUT_CELLS,
    OUTPUT_MANIFEST,
    OUTPUT_SUMMARY,
)


class GeographicImpactVerificationError(ValueError):
    """Raised when an independently calculated invariant differs."""


def verify_geographic_impact() -> dict[str, int | str]:
    """Cross-check source aggregation, materialization, summaries, and fingerprints."""

    manifest = _read_json(OUTPUT_MANIFEST)
    release_photo_ids = _release_ready_photo_ids(DEFAULT_RELEASE_DECISIONS)
    connection = duckdb.connect(":memory:")
    try:
        connection.execute("PRAGMA threads=1")
        connection.execute(
            "CREATE TABLE release_ready_photos (flickr_photo_id VARCHAR PRIMARY KEY)"
        )
        if release_photo_ids:
            connection.executemany(
                "INSERT INTO release_ready_photos VALUES (?)",
                [(photo_id,) for photo_id in sorted(release_photo_ids)],
            )
        source_sql = _source_aggregation_sql()
        source_totals = connection.execute(
            f"""
            {source_sql}
            SELECT
                count(*)::BIGINT AS impact_cell_count,
                sum(baseline_union_count)::BIGINT AS baseline_projection_count,
                sum(flickr_candidate_count)::BIGINT AS flickr_projection_count,
                sum(CASE WHEN baseline_range_inference_eligible_count > 0
                              AND flickr_candidate_count = 0 THEN 1 ELSE 0 END)::BIGINT
                    AS baseline_only_cell_count,
                sum(CASE WHEN baseline_range_inference_eligible_count > 0
                              AND flickr_candidate_count > 0 THEN 1 ELSE 0 END)::BIGINT
                    AS matched_cell_count,
                sum(CASE WHEN baseline_range_inference_eligible_count = 0
                              AND flickr_candidate_count > 0 THEN 1 ELSE 0 END)::BIGINT
                    AS candidate_only_cell_count
            FROM expected
            """
        ).fetchone()
        assert source_totals is not None
        total_names = (
            "impact_cell_count",
            "baseline_projection_count",
            "flickr_projection_count",
            "baseline_only_cell_count",
            "matched_cell_count",
            "candidate_only_cell_count",
        )
        totals = dict(zip(total_names, (int(value) for value in source_totals), strict=True))

        mismatch_count = connection.execute(
            f"""
            {source_sql},
            actual AS (
                SELECT
                    spatial_resolution,
                    spatial_cell_id,
                    provider_input_row_count,
                    baseline_union_count,
                    baseline_range_inference_eligible_count,
                    baseline_excluded_occurrence_count,
                    gbif_only_count,
                    inaturalist_origin_through_gbif_count,
                    duplicates_removed_count,
                    unresolved_provider_duplicate_group_count,
                    flickr_candidate_count,
                    flickr_visually_eligible_count,
                    reviewed_positive_count,
                    reviewed_negative_count,
                    uncertain_count,
                    pending_count,
                    media_failure_count,
                    skipped_count,
                    release_ready_count,
                    baseline_only_cell,
                    matched_cell,
                    candidate_only_cell,
                    reviewed_additional_cell,
                    release_ready_additional_cell
                FROM read_parquet({_sql_path(OUTPUT_CELLS)})
            ),
            differences AS (
                (SELECT * FROM expected EXCEPT SELECT * FROM actual)
                UNION ALL
                (SELECT * FROM actual EXCEPT SELECT * FROM expected)
            )
            SELECT count(*)::BIGINT FROM differences
            """
        ).fetchone()
        if mismatch_count is None or int(mismatch_count[0]) != 0:
            mismatch_label = mismatch_count[0] if mismatch_count else "missing"
            raise GeographicImpactVerificationError(
                f"DuckDB full-outer rows differ: {mismatch_label}"
            )

        global_mismatch_count = connection.execute(
            f"""
            WITH expected AS (
                SELECT
                    spatial_resolution,
                    count(*)::UBIGINT AS cell_count,
                    sum(baseline_union_count)::UBIGINT AS baseline_union_count,
                    sum(flickr_candidate_count)::UBIGINT AS flickr_candidate_count,
                    sum(candidate_only_cell::INTEGER)::UBIGINT AS candidate_only_cell_count
                FROM read_parquet({_sql_path(OUTPUT_CELLS)})
                GROUP BY spatial_resolution
            ),
            actual AS (
                SELECT
                    spatial_resolution,
                    cell_count,
                    baseline_union_count,
                    flickr_candidate_count,
                    candidate_only_cell_count
                FROM read_parquet({_sql_path(OUTPUT_SUMMARY)})
                WHERE scope_level = 'global'
            ),
            differences AS (
                (SELECT * FROM expected EXCEPT SELECT * FROM actual)
                UNION ALL
                (SELECT * FROM actual EXCEPT SELECT * FROM expected)
            )
            SELECT count(*)::BIGINT FROM differences
            """
        ).fetchone()
        if global_mismatch_count is None or int(global_mismatch_count[0]) != 0:
            raise GeographicImpactVerificationError("DuckDB global rollups differ")

        photo_totals = connection.execute(
            f"""
            SELECT
                count(DISTINCT flickr_photo_id)::BIGINT,
                count(DISTINCT flickr_photo_id) FILTER (WHERE cell_supported)::BIGINT
            FROM read_parquet({_sql_path(DEFAULT_FLICKR_GEOGRAPHY)})
            """
        ).fetchone()
        assert photo_totals is not None
        _require_equal(
            "manifest impact cells",
            manifest["impact_cell_count"],
            totals["impact_cell_count"],
        )
        _require_equal(
            "manifest baseline-only cells",
            manifest["baseline_only_cell_count"],
            totals["baseline_only_cell_count"],
        )
        _require_equal(
            "manifest matched cells",
            manifest["matched_cell_count"],
            totals["matched_cell_count"],
        )
        _require_equal(
            "manifest candidate-only cells",
            manifest["candidate_only_cell_count"],
            totals["candidate_only_cell_count"],
        )
        _require_equal(
            "manifest Flickr photos", manifest["flickr_candidate_count"], photo_totals[0]
        )
        _require_equal(
            "manifest supported Flickr photos",
            manifest["geographically_supported_flickr_candidate_count"],
            photo_totals[1],
        )
        _verify_artifact_fingerprints(manifest)
        return {
            **totals,
            "flickr_photo_count": int(photo_totals[0]),
            "supported_flickr_photo_count": int(photo_totals[1]),
            "mismatch_count": 0,
            "manifest_id": str(manifest["manifest_id"]),
        }
    finally:
        connection.close()


def _source_aggregation_sql() -> str:
    return f"""
    WITH baseline AS (
        SELECT
            spatial_resolution,
            spatial_cell_id,
            count(DISTINCT provider_relationship_id)::UBIGINT AS provider_input_row_count,
            count(DISTINCT canonical_observation_id)
                FILTER (WHERE canonical_flag)::UBIGINT AS baseline_union_count,
            count(DISTINCT canonical_observation_id)
                FILTER (WHERE canonical_flag AND range_inference_eligible)::UBIGINT
                AS baseline_range_inference_eligible_count,
            (count(DISTINCT canonical_observation_id) FILTER (WHERE canonical_flag)
             - count(DISTINCT canonical_observation_id)
                FILTER (WHERE canonical_flag AND range_inference_eligible))::UBIGINT
                AS baseline_excluded_occurrence_count,
            count(DISTINCT canonical_observation_id)
                FILTER (WHERE canonical_flag AND provider_source = 'gbif')::UBIGINT
                AS gbif_only_count,
            count(DISTINCT canonical_observation_id)
                FILTER (WHERE canonical_flag
                              AND provider_relationship_kind = 'inaturalist_via_gbif')::UBIGINT
                AS inaturalist_origin_through_gbif_count,
            count(DISTINCT provider_relationship_id)
                FILTER (WHERE exact_duplicate_removed)::UBIGINT AS duplicates_removed_count,
            count(DISTINCT unresolved_duplicate_group_id)
                FILTER (WHERE unresolved_duplicate_group_id IS NOT NULL)::UBIGINT
                AS unresolved_provider_duplicate_group_count
        FROM read_parquet({_sql_path(DEFAULT_BASELINE_UNION)})
        GROUP BY spatial_resolution, spatial_cell_id
    ),
    flickr AS (
        SELECT
            spatial_resolution,
            spatial_cell_id,
            count(DISTINCT flickr_photo_id)::UBIGINT AS flickr_candidate_count,
            count(DISTINCT flickr_photo_id)
                FILTER (WHERE machine_screening_state = 'target')::UBIGINT
                AS flickr_visually_eligible_count,
            count(DISTINCT flickr_photo_id)
                FILTER (WHERE human_review_state = 'reviewed_target_positive')::UBIGINT
                AS reviewed_positive_count,
            count(DISTINCT flickr_photo_id)
                FILTER (WHERE human_review_state = 'reviewed_non_target')::UBIGINT
                AS reviewed_negative_count,
            count(DISTINCT flickr_photo_id)
                FILTER (WHERE human_review_state = 'uncertain')::UBIGINT AS uncertain_count,
            count(DISTINCT flickr_photo_id)
                FILTER (WHERE human_review_state IN ('not_requested', 'pending'))::UBIGINT
                AS pending_count,
            count(DISTINCT flickr_photo_id)
                FILTER (WHERE human_review_state = 'media_failure')::UBIGINT
                AS media_failure_count,
            count(DISTINCT flickr_photo_id)
                FILTER (WHERE human_review_state = 'deferred')::UBIGINT AS skipped_count,
            count(DISTINCT flickr_photo_id)
                FILTER (WHERE flickr_photo_id IN
                    (SELECT flickr_photo_id FROM release_ready_photos))::UBIGINT
                AS release_ready_count
        FROM read_parquet({_sql_path(DEFAULT_FLICKR_GEOGRAPHY)})
        WHERE cell_supported
        GROUP BY spatial_resolution, spatial_cell_id
    ),
    expected_counts AS (
        SELECT
            coalesce(b.spatial_resolution, f.spatial_resolution)::UTINYINT
                AS spatial_resolution,
            coalesce(b.spatial_cell_id, f.spatial_cell_id) AS spatial_cell_id,
            coalesce(provider_input_row_count, 0)::UBIGINT AS provider_input_row_count,
            coalesce(baseline_union_count, 0)::UBIGINT AS baseline_union_count,
            coalesce(baseline_range_inference_eligible_count, 0)::UBIGINT
                AS baseline_range_inference_eligible_count,
            coalesce(baseline_excluded_occurrence_count, 0)::UBIGINT
                AS baseline_excluded_occurrence_count,
            coalesce(gbif_only_count, 0)::UBIGINT AS gbif_only_count,
            coalesce(inaturalist_origin_through_gbif_count, 0)::UBIGINT
                AS inaturalist_origin_through_gbif_count,
            coalesce(duplicates_removed_count, 0)::UBIGINT AS duplicates_removed_count,
            coalesce(unresolved_provider_duplicate_group_count, 0)::UBIGINT
                AS unresolved_provider_duplicate_group_count,
            coalesce(flickr_candidate_count, 0)::UBIGINT AS flickr_candidate_count,
            coalesce(flickr_visually_eligible_count, 0)::UBIGINT
                AS flickr_visually_eligible_count,
            coalesce(reviewed_positive_count, 0)::UBIGINT AS reviewed_positive_count,
            coalesce(reviewed_negative_count, 0)::UBIGINT AS reviewed_negative_count,
            coalesce(uncertain_count, 0)::UBIGINT AS uncertain_count,
            coalesce(pending_count, 0)::UBIGINT AS pending_count,
            coalesce(media_failure_count, 0)::UBIGINT AS media_failure_count,
            coalesce(skipped_count, 0)::UBIGINT AS skipped_count,
            coalesce(release_ready_count, 0)::UBIGINT AS release_ready_count
        FROM baseline b
        FULL OUTER JOIN flickr f
          ON b.spatial_resolution = f.spatial_resolution
         AND b.spatial_cell_id = f.spatial_cell_id
    ),
    expected AS (
        SELECT
            *,
            (baseline_range_inference_eligible_count > 0
                AND flickr_candidate_count = 0) AS baseline_only_cell,
            (baseline_range_inference_eligible_count > 0
                AND flickr_candidate_count > 0) AS matched_cell,
            (baseline_range_inference_eligible_count = 0
                AND flickr_candidate_count > 0) AS candidate_only_cell,
            (baseline_range_inference_eligible_count = 0
                AND reviewed_positive_count > 0) AS reviewed_additional_cell,
            (baseline_range_inference_eligible_count = 0
                AND release_ready_count > 0) AS release_ready_additional_cell
        FROM expected_counts
    )
    """


def _verify_artifact_fingerprints(manifest: dict[str, object]) -> None:
    artifacts = manifest.get("artifacts")
    if not isinstance(artifacts, list):
        raise GeographicImpactVerificationError("manifest artifacts are missing")
    for artifact in artifacts:
        if not isinstance(artifact, dict) or artifact.get("availability") != "available":
            continue
        path = REPOSITORY_ROOT / str(artifact["path"])
        content = path.read_bytes()
        _require_equal("artifact bytes", artifact["byte_size"], len(content))
        _require_equal("artifact SHA-256", artifact["sha256"], hashlib.sha256(content).hexdigest())


def _read_json(path: Path) -> dict[str, object]:
    value = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(value, dict):
        raise GeographicImpactVerificationError(f"JSON artifact is not an object: {path}")
    return value


def _release_ready_photo_ids(path: Path) -> set[str]:
    rows = _read_json(path).get("rows")
    if not isinstance(rows, list):
        raise GeographicImpactVerificationError("release decision rows are missing")
    return {
        str(row["flickr_photo_id"])
        for row in rows
        if isinstance(row, dict) and row.get("decision_status") == "release_ready"
    }


def _sql_path(path: Path) -> str:
    return "'" + path.as_posix().replace("'", "''") + "'"


def _require_equal(label: str, actual: object, expected: object) -> None:
    if actual != expected:
        raise GeographicImpactVerificationError(f"{label} differs: {actual!r} != {expected!r}")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.parse_args()
    result = verify_geographic_impact()
    print(json.dumps(result, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
