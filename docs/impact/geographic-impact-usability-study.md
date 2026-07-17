# Geographic Impact Lens usability study protocol

Protocol version: `taxalens-geographic-usability-protocol:v1.0.0`

Status: pending genuine participant sessions

## Purpose

This moderated, task-based study measures whether a biodiversity researcher can use the TaxaLens Geographic Impact Lens to locate potential coverage contribution, inspect the supporting evidence and begin human verification without mistaking a Flickr candidate for an occurrence or biological absence.

The protocol measures usability and interpretation. It does not validate taxonomic identity, estimate Flickr precision, authorize an occurrence release or prove that TaxaLens saves time. Scripted browser journeys and synthetic fixtures may test the instrument but never count as participants.

## Participants and consent

Recruit adults who routinely inspect biodiversity occurrence, collection, citizen-science or ecological spatial data. Record only a salted participant-ID hash, broad experience band and optional role category. Do not collect a name, email, employer, exact location, screen recording, voice recording or free-form demographic data in the default instrument.

Before beginning, the moderator must record informed consent for anonymous task telemetry and note whether the participant agrees to an optional anonymous quotation. A participant may stop at any time. An incomplete or withdrawn session is retained only when the participant permits retention; otherwise delete it and record no study row.

## Fixed environment

- Use the exact public replay fingerprint recorded in the session.
- Start at the Dashboard with scope Global, evidence mode All evidence and no selected cell.
- Use a supported desktop browser at a viewport of at least 1,280 × 720.
- Disable live credentials and external map resources.
- Do not preload an answer, country or record route.
- The moderator may restate a task but may not point to a control or interpret evidence for the participant.

## Task set

Each task begins when the moderator finishes reading the prompt and ends on the first qualifying completion event. Pauses, interruptions and moderator help are recorded separately from active time.

### Task 1 — Identify a country coverage gap

Prompt: “Find a country where Flickr candidate evidence could add potential spatial coverage relative to the selected baseline snapshot.”

Completion requires selecting a country and identifying at least one candidate-only spatial cell. Record time, selected country/cell, route, errors and whether the answer is supported by the committed impact artifact.

### Task 2 — Find an inspectable candidate record

Prompt: “Open one Flickr candidate from that geographic context that could be reviewed by a person.”

Completion requires opening a record-level Evidence Lens route bound to the selected cell. Record time, item/record ID, precision limitation and navigation errors.

### Task 3 — Inspect provenance

Prompt: “Show what source and snapshot evidence supports this candidate and explain what is still unknown.”

Completion requires opening baseline/provider provenance and stating that the Flickr result remains candidate evidence. Record time, inspected artifact IDs and interpretation answer.

### Task 4 — Begin verification

Prompt: “Begin the human-verification workflow for this result; do not submit a label unless you genuinely intend to review the image.”

Completion requires reaching the correct Verification item and displaying its checksum-verified media or an explicit media failure. Record time, route and errors. Study completion alone never creates a review event.

### Task 5 — Interpret the evidence state

Ask the participant to classify five statements as supported, unsupported or unavailable:

1. The selected cell contains Flickr candidate evidence.
2. The selected cell is absent from the selected baseline snapshot.
3. The species is biologically absent from the baseline-covered area.
4. A human-supported additional cell exists in the committed campaign.
5. A release-ready occurrence candidate exists in the committed campaign.

The artifact-backed answer key for the current zero-review replay is: supported, supported when the selected cell is candidate-only, unsupported, unsupported and unsupported. “Absent from the selected baseline snapshot” must not be interpreted as biological absence.

## Measures

For every task capture:

- active milliseconds and elapsed milliseconds;
- completion status and completion evidence;
- navigation/action count;
- moderator-help count;
- recoverable and unrecoverable errors;
- interpretation correctness when applicable;
- confidence on a 1–5 ordinal scale after the answer;
- an optional short comment.

Primary descriptive measures are:

- time to identify a country gap;
- time to find a candidate record;
- time to inspect provenance;
- time to begin verification;
- interpretation accuracy across the five statements;
- task confidence;
- error count and error categories.

Errors use the predeclared categories `wrong_scope`, `wrong_evidence_state`, `candidate_as_occurrence`, `absence_overclaim`, `provider_double_count`, `precision_ignored`, `wrong_record`, `wrong_verification_item`, `navigation`, and `other`.

## Session validity

A session is analysis-eligible only when consent is present, the build fingerprint matches, all timestamps are timezone-aware and monotonic, each task has exactly one final status, confidence values are in range and the participant is not a scripted or synthetic actor. Report withdrawn, invalid and incomplete sessions separately; never silently discard them.

Study observations are not verification outcomes. Participant task answers, confidence and errors must never be imported into the append-only review ledger or used as taxonomic labels.

## Analysis plan

Until genuine sessions exist, the report status is `pending_human_data` and every aggregate is unavailable.

When data exists, report count, median, minimum and maximum for time and actions; counts and proportions for completion and interpretation accuracy; median and range for ordinal confidence; and counts by error category. With fewer than five valid participants, show session-level values and avoid percentages that imply population precision. Do not report statistical significance, causal time savings or general researcher productivity without a separately powered comparative design.

Any comparison with the earlier scripted manual/assisted browser pilot must label that pilot as automation, not a human baseline.

## Human work remaining

1. Recruit and consent genuine participants.
2. Run the fixed protocol against the recorded build.
3. Inspect the raw JSON before committing or publishing it.
4. Confirm that no study row contains a real review label or direct identifier.
5. Generate the deterministic report and approve any public wording.
