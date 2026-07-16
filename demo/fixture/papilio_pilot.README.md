# Truthful Papilio pilot fixture

This is the first bounded TaxaLens judge fixture built from real, checksum-verified BioMiner pilot metadata. It is a metadata demonstration, not a successful species classification or an occurrence record.

The committed evidence supports exact query-hit, canonical-photo, geographic-cluster, source-candidate, competitor-plan, range-plan, deduplication-summary, and shortfall values. It does not support an image admitted as scientific evidence, a detection, a transformed full frame, a candidate visual score, or a human-verified target classification. Those fields remain explicitly unavailable.

The hero record is `papilio-demoleus-pilot-awaiting-review` and its state is `awaiting_human_review`. The target name identifies the research subject only. Every scientific-claim flag is false.

Three unmodified Wikimedia Commons JPEGs are included as content-addressed human-verification media. Each has an exact creator, source title and URL, CC BY-SA 4.0 licence and URI, SHA-256 digest, byte count, attribution, and non-scientific review use scope. `all_media_rights_verified` applies to those display rights only; the provider-supplied taxonomic identities remain unreviewed. BioMiner and TaxaLens metadata artifacts retain their MIT rights and attribution coverage.

`papilio_pilot/judge_bundle.json` is the entry point. The deterministic builder verifies the pinned BioMiner import, emits every payload, computes the inventory roots, and loads the finished bundle through the strict judge-bundle validator. The separate `contract_smoke` fixture remains schema-only; no schema-smoke record is mixed into this truthful pilot.
