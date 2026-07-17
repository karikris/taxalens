# TaxaLens Geographic Impact demo storyboard

Target runtime: **2 minutes 45 seconds**  
Format: 16:9, 1080p, cursor visible, captions on, one continuous product journey  
Product: <https://karikris.github.io/taxalens/>

## Editorial promise

Every number and state in the recording must come from the supported replay. Record from a reset
browser profile, do not pre-seed reviewer events, do not use private reference media, and do not
replace an unavailable or zero state with a mock. Keep baseline occurrence evidence, Flickr
candidate evidence, local workflow fixtures, retained human outcomes, and occurrence-release
decisions visibly distinct.

Core message:

> TaxaLens shows where Flickr candidate evidence has potential geographic coverage contribution,
> then keeps human support and release gates explicit.

## 32-second Geographic Impact hero sequence

| Time | Product action and shot | Narration / on-screen caption |
| --- | --- | --- |
| 0:00–0:05 | Open **05 Dashboard → TaxaLens Geographic Impact Lens** at Global. Hold on the full world map. | “Where does biodiversity evidence already exist—and where could Flickr expose more evidence to review?” Caption: **Global evidence comparison**. |
| 0:05–0:09 | Frame the legend and overlap of blue bubbles with hollow amber rings. | “Blue is the deduplicated baseline. Amber is Flickr candidate evidence, not an occurrence.” Caption: **19,201 baseline observations · 13,416 geographically supported candidates**. |
| 0:09–0:14 | Set **Continent: Europe**, then **Country: Sweden**. Keep the breadcrumb visible. | “The same evidence model drills from global to continent to country.” Caption: **Global › Europe › Sweden**. |
| 0:14–0:18 | Toggle **Human reviewed**. Hold on the empty Sweden map. | “The reviewed-only layer is empty because the public campaigns retain zero human outcomes.” Caption: **0 human-supported additional cells**. |
| 0:18–0:25 | Return to **Flickr candidates**, select cell `87088660cffffff`, then cut to **Evidence Lens → flickr:55081300254** and its loaded mini-map. | “A candidate-only cell opens to one record, its supported coordinate, baseline context, precision, and distance.” Caption: **Candidate location · not occurrence**. |
| 0:25–0:32 | Open **06 Agent Trace → GPT-5.6 geographic analyst**. Frame the Sweden answer and artifact receipts. | “GPT-5.6 explains deterministic receipts: 12 potential coverage-gap cells, 529 candidates, zero human-supported cells, and zero release-ready cells.” Caption: **Stored output · no live call · credential not required**. |

The hero is 32 seconds. Use direct cuts or the committed fixed-time frames; do not animate markers
between states or imply that a candidate matured during the sequence.

## Remaining product story

| Time | Product action and shot | Narration / on-screen caption |
| --- | --- | --- |
| 0:32–0:52 | From the selected record choose **Verify this result**. Hold on **Exact Flickr result cannot be viewed yet**, then briefly show the separate Commons cache with Yes, No, Can’t tell, Can’t view, Skip, and optional comment. | “TaxaLens fails closed when the exact source image is unavailable. A separate rights-cleared fixture demonstrates the human UI, but cannot verify this Flickr candidate.” Caption: **Human handoff · source boundary preserved**. |
| 0:52–1:10 | Return to **05 Dashboard**. Frame geographic review progress, unavailable QualitySnapshot, decisive count zero, and first milestone 20. | “Human-supported contribution is quality-gated. Skip and Can’t view never add support, and targeted failure-discovery work cannot justify an unweighted population claim.” Caption: **0 decisive audit outcomes · first milestone 20**. |
| 1:10–1:30 | In Selected geography and Engineering details, show provider composition, direct iNaturalist delta unavailable, full-outer join metrics, and exact table. | “The baseline union prevents GBIF and iNaturalist-origin double counting. No direct iNaturalist snapshot is committed, so that delta remains unavailable.” Caption: **4,017 GBIF-only · 15,184 iNaturalist-origin through GBIF**. |
| 1:30–1:50 | Briefly frame **Flickr Workload Map**, then return to **Geographic Impact Lens**. | “Workload Map answers where processing work exists. Geographic Impact asks where candidate evidence may add coverage after review. Operational density is not scientific contribution.” Caption: **Workload ≠ impact**. |
| 1:50–2:12 | In Sweden choose **Prepare geographic export**. Frame seven files, checksums, snapshot IDs, source SHAs, unsigned manifest, and `scientificClaimAllowed: false`. | “Seven deterministic outputs preserve exact cells, summaries, methodology, provenance, and the blocked scientific claim.” Caption: **Evidence can move without losing its limits**. |
| 2:12–2:32 | Direct cuts through Verification and Quality. Overlay **20 → 10 scripted actions**, **0 human participants**, and **753 ms → 2,752 ms**. | “One matched scripted Chromium pair halved interaction count, while assisted automation ran slower. Human time savings and scientific-quality change remain unmeasured.” |
| 2:32–2:45 | End on the global map, zero-reviewed caption, and public URL. | “TaxaLens turns candidate-only cells into a reviewable research agenda—without presenting hypotheses as reviewed evidence added.” Caption: **Potential coverage contribution · human review required**. |

Total planned runtime: **165 seconds**.

## Required evidence-state transitions

The strongest visual transition is:

```text
hollow amber candidate rings
→ reviewed-only layer with zero retained outcomes
→ record-level human handoff
→ release gate remains zero
```

Do not create an illustrative non-zero reviewed marker. A future retake may show a solid amber
human-supported marker only after a genuine retained target-positive outcome, sampling provenance,
valid QualitySnapshot, and updated materialized impact artifact are committed. A dark-stroked
release-ready marker additionally requires every occurrence-release gate.

## Model and engineering roles

**GPT-5.6 at runtime**

- reads checksum-bound evidence through bounded, read-only tools;
- interprets deterministic counts, joins, rankings, distances, and release state;
- cites the baseline and Flickr snapshots, impact artifacts, hierarchy, campaign, quality state,
  and source SHAs;
- replays stored output publicly with no credential or live request; and
- cannot identify the species from memory, invent geographic novelty, act as a human reviewer, or
  authorize release.

**Codex at build time**

- helped implement product code, contracts, tests, documentation, captures, and provenance;
- is disclosed through commit trailers, the AI provenance report, and the recorded session ID; and
- is not a runtime component, image classifier, reviewer identity, or scientific authority.

## Artifact-backed captions

| Caption | Evidence |
| --- | --- |
| 19,201 baseline observations | `baseline_provider_union_manifest.json`; distinct canonical IDs |
| 4,017 GBIF-only; 15,184 iNaturalist-origin through GBIF | Provider relationship artifact and union report |
| 13,416 geographically supported Flickr candidates | Geographic Impact manifest; resolution-3 global materialization |
| 1,221 potential coverage-gap cells | Resolution-3 full-outer impact cells |
| Sweden: 529 candidates in 12 candidate-only cells | Stored geographic analyst replay at resolution 7 |
| 0 human-supported and 0 release-ready additional cells | Verification consensus, unavailable quality state, and empty release decisions |
| Direct iNaturalist delta unavailable | No committed direct snapshot; provider-union manifest |
| Six geographic tools and 24 evaluation cases | Geographic analyst contracts and deterministic evaluation |
| Seven geographic export files | Geographic export manifest and browser journey test |
| 20 → 10 scripted actions; 753 ms → 2,752 ms; 0 humans | [`docs/impact/verification-productivity-summary.md`](../docs/impact/verification-productivity-summary.md) |

## Capture checklist

- Reset replay before recording; do not reuse scripted decisions as human evidence.
- Record Global → Europe → Sweden with breadcrumb, slicers, and camera synchronized.
- Show the blue and amber legend before quoting counts.
- Keep the reviewed-only zero state on screen long enough to read.
- Show candidate cell `87088660cffffff` and record `flickr:55081300254` without calling either an
  occurrence.
- Keep the record mini-map precision and baseline-context caption legible.
- Keep the exact Flickr media-unavailability warning on screen long enough to read.
- Never imply that the Commons workflow fixture verifies the Flickr source.
- Show **Stored output · no live call**, artifact citations, and the geographic analyst limitations.
- Keep direct iNaturalist delta **Unavailable**, quality snapshot **Unavailable**, and
  `scientificClaimAllowed: false` legible.
- Do not say or imply biological absence, reviewed geographic uplift, precision, accuracy, human
  time saved, or scientific release.
- End before 3:00.
