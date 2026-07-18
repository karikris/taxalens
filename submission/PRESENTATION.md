# TaxaLens — Geographic Impact presentation

Eight slides · recommended delivery: 2 minutes 40 seconds

---

## Slide 1 — Where could candidate evidence add coverage?

> TaxaLens compares existing biodiversity evidence with Flickr candidates, then keeps human review
> and occurrence-release gates visible all the way to the map.

**Show:** the real global Chromium capture in
[`apps/web/e2e/geographic-impact.visual.spec.ts-snapshots/geographic-impact-global-1280x720-chromium-linux.png`](../apps/web/e2e/geographic-impact.visual.spec.ts-snapshots/geographic-impact-global-1280x720-chromium-linux.png).

**Say:** Social-media discovery can expose promising geographic hypotheses, but a search hit,
provider label, or model score is not an occurrence. TaxaLens asks where baseline evidence exists,
where Flickr candidate evidence appears, and what remains before contribution can be supported.

---

## Slide 2 — One evidence comparison, not two inflated datasets

| Global resolution-3 view | Artifact-backed state |
| --- | ---: |
| Full-outer spatial cells | 2,155 |
| Deduplicated baseline observations | 19,201 |
| GBIF-only | 4,017 |
| iNaturalist-origin through GBIF | 15,184 |
| Direct iNaturalist delta | Unavailable |
| Geographically supported Flickr candidates | 13,416 |

**Show:** the legend and synchronized exact table.

**Say:** Blue bubbles are a canonical provider union, not GBIF plus iNaturalist double counting.
Amber markers are Flickr candidate evidence. Hollow, filled, dashed, excluded, and dark-stroked
states make maturity legible without relying on colour alone. Both layers use one square-root count
scale, and exact values remain in the table and tooltip.

---

## Slide 3 — Potential is not reviewed, and reviewed is not released

```text
1,221 potential coverage-gap cells
              ↓ retained target-positive human review
0 human-supported additional cells
              ↓ coordinate + duplicate + quality + provenance + release gates
0 release-ready additional cells
```

**Show:** **Selected geography → Potential contribution** and the **Evidence maturity** controls.

**Say:** A candidate-only spatial cell means Flickr evidence exists where the selected baseline
snapshot has no eligible row. That is potential coverage contribution, never biological absence.
The public campaigns contain zero retained human outcomes, so TaxaLens renders an honest empty
human-reviewed layer and an unavailable quality snapshot.

---

## Slide 4 — One global evidence comparison

```text
Global baseline evidence ↔ global Flickr candidate evidence
```

- The global resolution-3 scope contains 19,201 baseline rows, 13,416 geographically supported
  Flickr candidates, and 1,221 potential coverage-gap cells.
- It contains zero human-supported additional cells and zero release-ready additional cells.
- Regional drilldown remains available to researchers, but no named country or candidate record is
  promoted as the representative project geography.

**Show:** the fixed-time global 1280×720 Geographic Impact regression capture.

**Say:** The same global scope identity drives the map, table, details, stored analyst replay, and
export. A candidate location is never elevated merely because it is convenient for a demo.

---

## Slide 5 — The human handoff fails closed

- The exact Flickr result has no committed checksum-verified review image.
- Yes, No, and Can’t tell remain unavailable for that result.
- Can’t view records media failure; Skip records deferred work. Neither adds geographic support.
- A separate three-image, CC-licensed Commons packet demonstrates the reviewer UI and optional
  comment without verifying the Flickr source.
- Append-only events, consensus, conflicts, sampling weights, and QualitySnapshot gates remain
  distinct from scientific release.

**Show:** Evidence Lens **Verify this result**, the exact-image warning, and the real verification
capture in [`docs/assets/taxalens-verification-workflow.png`](../docs/assets/taxalens-verification-workflow.png).

**Say:** TaxaLens has a mature verification system, but this public geographic campaign has no
retained outcome. The map updates local review operations without silently creating an occurrence.

---

## Slide 6 — Quality and contribution stay bounded

| Current state | Value |
| --- | ---: |
| Flickr campaign assignments | 49 |
| Inclusion-weighted decisive Flickr audit outcomes | 0 |
| First quality checkpoint | 20 |
| Human-supported additional cells | 0 |
| Release-ready occurrence candidates | 0 |
| Direct iNaturalist delta | Unavailable |

**Show:** geographic review progress, QualitySnapshot disclosure, and release status.

**Say:** Targeted failure-discovery work cannot support an unweighted population claim. Skip and
Can’t view cannot support contribution. Missing baseline evidence remains data deficiency, and a
reviewed target-positive result still needs every occurrence-release gate.

---

## Slide 7 — GPT-5.6 explains artifacts; it does not calculate novelty

- Six deterministic, read-only geographic tools inspect impact, compare scopes, list candidate-gap
  cells, explain contribution, recommend review batches, and inspect the provider union.
- Every result cites the baseline snapshot, Flickr snapshot, impact artifacts, country hierarchy,
  campaign, quality state, and source SHAs.
- The public global replay uses one stored inspection receipt and no credential or live request.
- It reports 1,221 potential coverage-gap cells, 13,416 candidates, zero human-supported cells, and
  zero release-ready cells.
- Twenty-four geographic evaluations reject provider double counting, absence claims, invalid
  quality inference, blocked release, missing citations, and model-memory arithmetic.

**Show:** **Agent Trace → GPT-5.6 geographic analyst → Inspect geographic tool receipts**.

**Say:** Deterministic code performs counts, joins, distances, and rankings. GPT-5.6 interprets
those receipts; it cannot invent geographic contribution or authorize release.

---

## Slide 8 — Inspect, review, export

- The hosted replay is public, static, resettable, credential-free, and uses no external map
  request.
- The Flickr Workload Map remains a separate operational view; Geographic Impact is the scientific
  evidence-comparison view.
- Seven geographic exports carry exact cells, scope summary, methodology, provenance, checksums,
  snapshot IDs, and source SHAs.
- `scientificClaimAllowed: false` remains explicit.
- Real retained human outcomes, a valid quality snapshot, and occurrence-release decisions remain
  human work.

**Show:** prepare the geographic export, then end on
<https://karikris.github.io/taxalens/>.

**Close:** TaxaLens turns amber candidate-only cells into a reviewable research agenda—and makes it
impossible to mistake that agenda for reviewed evidence added.

---

## Presenter fact check

- Say **baseline occurrence evidence**, **Flickr candidate evidence**, and **potential coverage
  contribution**.
- Do not call a candidate an occurrence or present a candidate-only cell as an established range
  extension.
- Do not describe missing baseline evidence as biological absence.
- Do not add GBIF rows and iNaturalist-origin GBIF rows a second time.
- Do not call provider taxon labels human review.
- Do not count Skip, Can’t view, or Can’t tell as target-positive review.
- Do not call a reviewed positive release-ready unless every occurrence-release gate passes.
- State that direct iNaturalist delta and the quality snapshot are unavailable.
- Keep the zero retained human outcomes visible whenever the human-supported layer is shown.
