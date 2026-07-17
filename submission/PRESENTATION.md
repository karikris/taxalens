# TaxaLens — verification-centered presentation

Eight slides · recommended delivery: 2 minutes 40 seconds

---

## Slide 1 — From candidate to evidence

> TaxaLens turns machine-screened biodiversity candidates into statistically characterized, human-verifiable evidence.

**Show:** the actual TaxaLens verification capture from
[`docs/assets/taxalens-verification-workflow.png`](../docs/assets/taxalens-verification-workflow.png).

**Say:** Social-media discovery can surface useful biodiversity candidates, but a search hit, model
score, or provider label is not a verified occurrence. TaxaLens makes the evidence trail,
human-review work, uncertainty, and release boundary inspectable.

---

## Slide 2 — The problem is an evidence gap

- 76,485 query-hit associations resolve to 13,501 canonical Flickr source-photo records.
- 838 records are eligible source-media candidates.
- The hero *Papilio demoleus* record is still `awaiting_human_review`.
- No scientific image, calibrated decision, precision estimate, or confirmed occurrence is
  committed for that hero.

**Show:** Evidence Lens on `flickr:55081300254`, including its unavailable visual evidence.

**Say:** TaxaLens does not turn workload into biological truth. It shows why the candidate exists,
what can be inspected, and exactly which evidence is missing.

**Evidence:** judge bundle and
[`demo/source/verification/verification-evidence-availability.json`](../demo/source/verification/verification-evidence-availability.json).

---

## Slide 3 — One coherent human-verification journey

```text
Mission → Evidence Lens → Verification → Quality → GPT-5.6 → Export
```

- Plan an 80-decision budget, 40-owner audit sample, two reviewer labels, ±20-point planning
  objective, and required reference review.
- Route the exact Flickr candidate to verification.
- Fail closed when its checksum-verified media is unavailable.
- Use the separate three-image, CC-licensed Commons packet to exercise Yes, No, Can’t tell,
  Can’t view, Skip, and an optional comment.
- Preserve append-only reviewer events and prior decisions.

**Say:** A reviewer can only make a decisive taxonomic choice after verified media is displayed.
Skip remains deferred work; Can’t view remains a media failure. The Commons packet demonstrates
the workflow and does not verify the routed Flickr result.

---

## Slide 4 — Characterize quality without inventing it

| Current campaign inventory | Artifact-backed state |
| --- | ---: |
| Commons workflow fixtures | 3 |
| Private Flickr audit items | 49 |
| Private GBIF/iNaturalist reference items | 24 |
| Reviewer-control assignments | 6 |
| Total campaign assignments | 82 |
| Inclusion-weighted decisive Flickr audit outcomes | 0 |
| First quality checkpoint | 20 |

**Show:** Dashboard cards for decisive coverage, reference readiness, conflicts, quality interval,
and next milestone.

**Say:** One local Commons choice can change workflow coverage from 0 / 82 to 1 / 82. It cannot
change Flickr precision or reference readiness. The target-precision interval therefore remains
**Unavailable**, and reference readiness remains 0 / 24 independently reviewed.

---

## Slide 5 — Acknowledging BioMiner’s human-verified data

- BioMiner is the evidence engine for registry construction, Flickr metadata, deduplication,
  YOLOE routing, BioCLIP screening, reference resolution, and scientific evaluation.
- The current planning source is
  `94fa1f634ee3c63917c05d78181dd3cf9ceff940`.
- Its 81 / 81 receipt records direct-user confirmation that records suit their assigned
  **prototype roles**.
- TaxaLens acknowledges that human-verified suitability while keeping independent taxonomic
  verification at 0.
- YOLOE and BioCLIP screening have no local five-image cap; explicit campaign workloads remain
  deliberately bounded.

**Say:** This boundary matters: upstream human confirmation is real evidence for prototype-role
suitability, but it is not silently promoted into a species label, reference decision, or accuracy
result.

---

## Slide 6 — GPT-5.6 recommends; humans decide

- The public product replays validated, stored `gpt-5.6-sol` outputs with no credential or live
  model request.
- Its verification analyst uses five read-only evidence tools across six stored response turns.
- The visible next action is **adjudication** for one intentionally conflicted synthetic control.
- The panel identifies artifact IDs and says **Synthetic evaluation evidence · not current browser
  state**.
- GPT-5.6 cannot identify a species from memory, fabricate a quality metric, or authorize release.

**Show:** **Agent Trace → GPT-5.6 next review action**.

**Say:** The model reads bounded evidence and prioritizes the next review; a human supplies the
decision. Codex was the build-time engineering collaborator for code, tests, documentation, and
provenance—not a runtime scientific reviewer.

---

## Slide 7 — Measured impact, with the boundary attached

| Same three-item scripted task | Manual protocol | TaxaLens-assisted |
| --- | ---: | ---: |
| Browser actions | 20 | 10 |
| Active browser-protocol time | 753 ms | 2,752 ms |
| Human participants | 0 | 0 |

**Say:** One matched scripted Chromium pair reduced interaction count by 50%. The assisted
automation was slower in elapsed execution time. With zero human participants, human time saved,
human productivity, scientific-quality change, and population savings are unavailable.

**Evidence:** [`docs/impact/verification-productivity-summary.md`](../docs/impact/verification-productivity-summary.md)
and its checksum-bound raw JSON.

---

## Slide 8 — Inspect, decide, export

- Six deterministic research outputs carry checksums and the evidence boundary.
- The hosted replay is public, static, resettable, and credential-free.
- `GO_PROTOTYPE_ONLY` permits explicit prototype integration only.
- `scientificClaimAllowed: false` remains in the exported evaluation.
- Independent review, a weighted quality interval, reference readiness, and scientific release
  remain human work.

**Show:** prepare the six outputs, then end on the product URL:
<https://karikris.github.io/taxalens/>.

**Close:** TaxaLens makes machine-screened candidates reviewable now, while making every missing
scientific prerequisite impossible to overlook.

---

## Presenter fact check

- Do not call a candidate an occurrence.
- Do not call a raw model score a probability.
- Do not call BioMiner’s 81 / 81 prototype-role suitability independent taxonomic verification.
- Do not count Skip, Can’t view, or Can’t tell as a decisive reviewed label.
- Do not claim the public Commons packet verifies the routed Flickr result.
- Do not imply that a stored synthetic GPT-5.6 conflict is current human-review data.
- Do not state a precision interval until inclusion-weighted decisive Flickr audit outcomes exist.
