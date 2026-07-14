from pathlib import Path

from packages.replay.src.biominer_stage_metrics_adapter import (
    StageMetricsAdapterError,
    adapt_stage_metrics,
)


def test_adapt_stage_metrics_from_fixture() -> None:
    fixture = Path("packages/replay/tests/fixtures/run_manifest_stage_metrics.json")
    result = adapt_stage_metrics(
        manifest_path=fixture,
        biominer_commit="1535c494f9403e22ed9b163f3ae0ce3706e17f4c",
    )

    stage_metrics = result["stage_metrics"]
    assert len(stage_metrics) == 7

    resolve = next(item for item in stage_metrics if item["stage_id"] == "resolve_taxon_scope")
    assert resolve["schema_version"] == "stage_metric:v1"
    assert resolve["biominer_commit"] == "1535c494f9403e22ed9b163f3ae0ce3706e17f4c"
    assert resolve["join_type"] == "hash_join"

    detect = next(item for item in stage_metrics if item["stage_id"] == "detect_objects")
    assert detect["rows_in"] == 44
    assert detect["rows_out"] == 37
    assert detect["cache_hits"] == 0
    assert detect["retries"] == 2
    assert detect["join_type"] == "nearest_neighbour"

    score = next(item for item in stage_metrics if item["stage_id"] == "score_bioclip")
    assert score["rows_out"] == 37
    assert score["bytes_scanned"] == 10240
    assert score["bytes_written"] == 4096
    assert score["cache_misses"] == 2
    assert score["retries"] == 1
    assert score["produced_sha256"] == "sha256:abc123"

    target = next(item for item in stage_metrics if item["stage_id"] == "target_aware_scoring")
    assert target["operation_type"] == "target_aware_scoring"
    assert target["schema_version_ref"] == "target-aware-candidate-scores-v1.0.0"
    assert target["output_artifact_id"] == "staging/target_aware_object_scores.parquet"

    compatibility = result["compatibility"]
    assert compatibility["unknown_stages"] == ["mystery_custom_stage"]
    assert compatibility["source_path"] == str(fixture)
    assert any(
        "mystery_custom_stage" in str(note) for note in compatibility["notes"]
    )


def test_adapt_stage_metrics_rejects_invalid_biominer_sha() -> None:
    fixture = Path("packages/replay/tests/fixtures/run_manifest_stage_metrics.json")
    try:
        adapt_stage_metrics(manifest_path=fixture, biominer_commit="short-sha")
    except StageMetricsAdapterError as exc:
        assert "40-character" in str(exc)
    else:
        assert False


def test_adapt_stage_metrics_rejects_manifest_without_stages() -> None:
    fixture = Path("packages/replay/tests/fixtures/run_manifest_stage_metrics_missing_stages.json")
    try:
        adapt_stage_metrics(
            manifest_path=fixture,
            biominer_commit="1535c494f9403e22ed9b163f3ae0ce3706e17f4c",
        )
    except StageMetricsAdapterError as exc:
        assert "stages" in str(exc)
    else:
        assert False
