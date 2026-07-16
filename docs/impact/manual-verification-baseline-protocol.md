# Manual verification baseline protocol

This instrument measures the interaction burden of a verification task completed
without TaxaLens assistance. It does not estimate biological accuracy, human
productivity in general, or time savings by itself.

Use the same frozen task set, instructions, decision labels, reviewer, device,
and stopping rule for the manual and TaxaLens-assisted sessions. Do not show
TaxaLens campaign ordering, duplicate groups, reference context, or model
evidence during the manual baseline.

## Raw event procedure

1. Create a session with `createManualVerificationBaseline`. Hash a local
   participant alias before passing it to the instrument; never store the raw
   name or email.
2. Start active time only when the participant begins the task.
3. Record exactly one action event for every observable action:
   - `page_opened` for a page, tab, document, or source record opened;
   - `duplicate_inspected` when a duplicate group is checked;
   - `field_completed` when a required output field is completed;
   - `decision_recorded` when one Yes, No, Can’t tell, Can’t view, or Skip
     decision is committed;
   - `other` for any other task action.
4. Pause during breaks, interruptions, setup, or facilitator discussion. Resume
   when work restarts.
5. Complete the session once the frozen stopping rule is met. Preserve the raw
   session JSON before calculating a summary.

The summary reports active and elapsed minutes, total actions, pages opened,
duplicates inspected, fields completed, and decisions. Counts are event counts;
the corresponding unique counts are reported separately. Skip and Can’t view
remain decisions for workload accounting but are not scientific reviews.

## Comparison rules

- Match sessions only when `taskSetId` and the protocol version agree.
- Report raw sample size and individual session measurements.
- Separate scripted browser measurements from human sessions.
- Do not convert a single participant or scripted run into a population claim.
- Do not report savings when a matched baseline and assisted session are absent.
- Keep quality outcomes separate from workflow burden.
