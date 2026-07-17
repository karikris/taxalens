# TaxaLens verification-centered demo storyboard

Target runtime: **2 minutes 45 seconds**  
Format: 16:9, 1080p, cursor visible, captions on, one continuous product journey  
Product: <https://karikris.github.io/taxalens/>

## Editorial promise

Every number and state in the recording must come from the supported replay. Record from a reset
browser profile, do not pre-seed reviewer events, do not use private reference media in the public
cut, and do not replace an unavailable result with a mock. Keep the exact Flickr source, the
separate Commons workflow fixture, and the private GBIF/iNaturalist reference campaign visibly
distinct.

Core message:

> TaxaLens turns machine-screened biodiversity candidates into statistically characterized, human-verifiable evidence.

## Hero sequence and narration

| Time | Product action and shot | Narration / on-screen caption |
| --- | --- | --- |
| 0:00–0:12 | Open **03 Evidence Lens**, choose **Inspect verified discovery record**, and frame *Papilio demoleus*, `gbif:1938069`, and source `flickr:55081300254`. | “Machine screening found a candidate, not an occurrence. TaxaLens starts by showing its evidence and gaps.” Caption: **Candidate · awaiting human review**. |
| 0:12–0:25 | Select **Verify this result**. Hold on **Exact Flickr result cannot be viewed yet**. | “The exact Flickr result has no committed checksum-verified review image, so TaxaLens will not enable a taxonomic answer.” Caption: **Unavailable media fails closed**. |
| 0:25–0:52 | In the separate **Reference Images** Commons fixture, choose **Prepare review cache**. Show the verified image, its label and attribution. Add an optional comment and choose one decisive Yes or No outcome. | “A separate, rights-cleared three-image packet demonstrates the human handoff. The reviewer sees the image and label before deciding. Can’t tell, Can’t view, and Skip remain explicit alternatives.” Caption: **Workflow fixture · does not verify the Flickr source**. |
| 0:52–1:08 | Open **05 Dashboard**. Frame **Decisive coverage** changing from 0 / 82 to 1 / 82, then **Quality interval: Unavailable** and **Next review milestone: 20**. | “That append-only event changes campaign coverage. It does not create a Flickr precision result: zero inclusion-weighted decisive Flickr audit outcomes exist.” Caption: **Coverage changes · quality remains unavailable**. |
| 1:08–1:30 | Return to **04 Verification → Reference Images**. Select **GBIF**, then **iNaturalist**, showing zero public items. Return to **All** and briefly show the structured reference-annotation controls on the Commons workflow fixture. Then show **Reference readiness: 0 / 24**. | “GBIF and iNaturalist reference review is a separate private 24-item campaign. The public replay exposes no private images or completed decisions, so readiness correctly stays zero of 24.” Caption: **Reference workflow inspected · readiness remains blocked**. |
| 1:30–1:53 | Open **06 Agent Trace → GPT-5.6 next review action**. Frame **Stored output · no live call**, **adjudication**, five tool calls, artifact IDs, and **Synthetic evaluation evidence · not current browser state**. | “GPT-5.6 reads bounded evidence and recommends adjudicating an intentionally conflicted synthetic control. It does not identify the species or claim that this conflict exists in the browser ledger.” |
| 1:53–2:16 | Return to **05 Dashboard → Export research outputs** and select **Prepare six research outputs**. Frame checksums, `GO_PROTOTYPE_ONLY`, and `scientificClaimAllowed: false`. | “Six deterministic outputs preserve provenance, unavailable quality, and the prototype-only release boundary.” Caption: **Evidence can move without losing its limits**. |
| 2:16–2:32 | Fast recap using the committed four-view GIF or direct cuts: Mission → Lens → Verification → Quality. Overlay **20 → 10 scripted actions**, **0 human participants**, and **753 ms → 2,752 ms**. | “One matched scripted Chromium pair halved interaction count, from 20 actions to 10, while the assisted automation ran slower. Human time savings remain unmeasured.” |
| 2:32–2:45 | End on the verification screenshot and public URL. | “TaxaLens turns machine-screened biodiversity candidates into statistically characterized, human-verifiable evidence—without turning missing evidence into a confident answer.” |

Total planned runtime: **165 seconds**.

## Reference-readiness recording rule

The desired future beat is: review an authorized GBIF/iNaturalist reference image, import its
validated decision, and show reference readiness change. The current artifact-backed replay has no
public reference image and 0 / 24 independently reviewed reference results. Therefore this cut must
show the reference workflow and its **unchanged blocked state**. Do not animate, seed, edit, or
narrate a readiness increase.

A future retake may replace the 1:08–1:30 shot only after all of these are committed:

1. rights-cleared authorized review media that is not exposed beyond its allowed scope;
2. a real human decision with reviewer and media-display evidence;
3. a validated BioMiner-compatible reference-decision import;
4. an updated fingerprinted quality snapshot; and
5. a release-gate test proving the reference result cannot leak into final evaluation.

## Model and engineering roles

**GPT-5.6 at runtime**

- reads only checksum-bound evidence through bounded, read-only tools;
- explains missing evidence and recommends the next review action;
- replays stored output in the public product with no credential or live request;
- cannot label a species from memory, invent quality, act as a human reviewer, or authorize
  scientific release.

**Codex at build time**

- helped implement product code, contracts, tests, documentation, and provenance;
- is disclosed through commit trailers, the AI provenance report, and the recorded session ID;
- is not a runtime component, image classifier, reviewer identity, or scientific authority.

## Artifact-backed captions

| Caption | Evidence |
| --- | --- |
| 82 campaign assignments | Four committed campaign manifests: 3 Commons, 49 Flickr, 24 reference, 6 controls |
| 0 / 24 independent reference reviews | Reference campaign and current quality snapshot |
| Quality interval unavailable; first checkpoint 20 | Verification evidence availability and Dashboard quality projection |
| 81 / 81 prototype-role suitable; 0 independently taxonomically verified | Pinned BioMiner suitability receipt |
| 20 → 10 scripted actions; 753 ms → 2,752 ms; 0 humans | [`docs/impact/verification-productivity-summary.md`](../docs/impact/verification-productivity-summary.md) |
| Five GPT-5.6 verification tools and six response turns | Stored verification analyst replay |
| Six outputs; `GO_PROTOTYPE_ONLY`; scientific claim false | Dashboard export and prototype-boundary artifacts |

## Capture checklist

- Reset replay before recording; do not reuse scripted decisions as human evidence.
- Keep the exact Flickr unavailability warning on screen long enough to read.
- Show visible CC BY-SA 4.0 attribution with the Commons image.
- Show Yes, No, Can’t tell, Can’t view, Skip, and the optional comment field in one frame.
- Never call Skip reviewed or decisive.
- Never call the Commons workflow item a GBIF/iNaturalist reference result.
- Never call BioMiner’s human-confirmed prototype-role suitability taxonomic verification.
- Keep **Unavailable**, **0 / 24**, **Synthetic evaluation evidence**, and
  `scientificClaimAllowed: false` legible.
- State the measured impact actor, sample, and slower assisted timing in the same shot.
- Do not say or imply precision, accuracy, human time saved, or scientific release has been
  measured.
- End before 3:00.
