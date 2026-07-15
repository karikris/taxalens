import { useMemo, useState } from 'react'
import {
  Button,
  FieldError,
  Form,
  Group,
  Input,
  Label,
  ListBox,
  ListBoxItem,
  NumberField,
  Popover,
  Radio,
  RadioGroup,
  Select,
  SelectValue,
  Text,
  TextField,
} from 'react-aria-components'

import type { MissionEvidence, ReplayIdentity } from '../data/evidenceFacade'
import { EvidenceState, EvidenceTier } from '../design-system'
import './mission.css'

type RetrievalPolicy = 'global_then_assign_to_flickr_clusters' | 'target_supported_countries'
type ReferencePolicy = 'human_review_before_support_use' | 'metadata_planning_only'
type EvidenceStrictness = 'block_unverified_claims' | 'metadata_exploration_only'
type MissionMode = 'replay' | 'live'

interface MissionDraft {
  readonly targetSpecies: string
  readonly region: string
  readonly retrievalPolicy: RetrievalPolicy
  readonly maximumApiCalls: number
  readonly candidateLimit: number
  readonly referencePolicy: ReferencePolicy
  readonly evidenceStrictness: EvidenceStrictness
  readonly mode: MissionMode
  readonly device: string
}

interface MissionWorkspaceProps {
  readonly evidence: MissionEvidence
  readonly target: ReplayIdentity['target']
}

interface SelectOption<T extends string> {
  readonly id: T
  readonly label: string
}

function humanize(value: string): string {
  return value.replaceAll('_', ' ')
}

function missionBaseline(evidence: MissionEvidence, target: ReplayIdentity['target']): MissionDraft {
  return {
    targetSpecies: target.scientificName,
    region: 'global',
    retrievalPolicy: evidence.queryPolicy.defaultRetrievalPolicy as RetrievalPolicy,
    maximumApiCalls: evidence.budgets.materializedRequestCount,
    candidateLimit: evidence.candidatePolicy.candidateCount,
    referencePolicy: 'human_review_before_support_use',
    evidenceStrictness: 'block_unverified_claims',
    mode: 'replay',
    device: '',
  }
}

function PolicySelect<T extends string>({
  description,
  label,
  onChange,
  options,
  value,
}: {
  readonly description: string
  readonly label: string
  readonly onChange: (value: T) => void
  readonly options: readonly SelectOption<T>[]
  readonly value: T
}) {
  return (
    <Select
      className="mission-field mission-select"
      selectedKey={value}
      onSelectionChange={(key) => onChange(String(key) as T)}
    >
      <Label>{label}</Label>
      <Button className="mission-select__trigger">
        <SelectValue />
        <span aria-hidden="true">⌄</span>
      </Button>
      <Text slot="description">{description}</Text>
      <Popover className="mission-select__popover">
        <ListBox>
          {options.map((option) => (
            <ListBoxItem key={option.id} id={option.id} textValue={option.label}>
              {option.label}
            </ListBoxItem>
          ))}
        </ListBox>
      </Popover>
    </Select>
  )
}

export function MissionWorkspace({ evidence, target }: MissionWorkspaceProps) {
  const baseline = useMemo(() => missionBaseline(evidence, target), [evidence, target])
  const [draft, setDraft] = useState<MissionDraft>(baseline)
  const targetMatchesBundle = draft.targetSpecies.trim().toLocaleLowerCase() ===
    target.scientificName.toLocaleLowerCase()
  const incompleteGates = evidence.prerequisiteGates.filter((gate) => gate.status !== 'complete')
  const countryCount = evidence.regions.reduce((total, region) => total + region.countryCount, 0)

  function update<K extends keyof MissionDraft>(field: K, value: MissionDraft[K]) {
    setDraft((current) => ({ ...current, [field]: value }))
  }

  return (
    <section className="mission-workspace" aria-labelledby="target-title">
      <div className="mission-workspace__intro">
        <div>
          <EvidenceTier tier="metadata" />
          <p className="eyebrow mission-panel__kicker">Research mission</p>
          <h2 id="target-title">
            <i>{target.scientificName}</i>
          </h2>
          <p className="lede">
            Configure a bounded evidence investigation. The target identifies the mission. It is not
            a classification of an image, and these settings do not start live work.
          </p>
        </div>
        <EvidenceState state="review" title="Awaiting human review" compact>
          Planning evidence only. No candidate can support a scientific claim yet.
        </EvidenceState>
      </div>

      <div className="mission-layout">
        <section className="mission-card mission-card--form" aria-labelledby="mission-settings-title">
          <p className="eyebrow">Draft controls</p>
          <h3 id="mission-settings-title">Mission settings</h3>
          <Form
            className="mission-form"
            validationBehavior="native"
            onSubmit={(event) => event.preventDefault()}
          >
            <fieldset>
              <legend>Target and range</legend>
              <TextField
                className="mission-field"
                isRequired
                value={draft.targetSpecies}
                onChange={(value) => update('targetSpecies', value)}
              >
                <Label>Target species</Label>
                <Input />
                <Text slot="description">
                  The submitted replay is bound to <i>{target.scientificName}</i> ({target.acceptedTaxonKey}).
                </Text>
                <FieldError>Enter a target species.</FieldError>
              </TextField>

              <PolicySelect
                label="Region"
                description="Regions are range-planning hypotheses, not confirmed occurrence boundaries."
                value={draft.region}
                onChange={(value) => update('region', value)}
                options={[
                  { id: 'global', label: `Global · all ${evidence.regions.length} planned regions` },
                  ...evidence.regions.map((region) => ({ id: region.name, label: region.name })),
                ]}
              />
            </fieldset>

            <fieldset>
              <legend>Evidence policy</legend>
              <PolicySelect
                label="Retrieval policy"
                description="The global policy is the committed pilot default."
                value={draft.retrievalPolicy}
                onChange={(value) => update('retrievalPolicy', value)}
                options={[
                  {
                    id: 'global_then_assign_to_flickr_clusters',
                    label: 'Global, then assign to Flickr clusters',
                  },
                  { id: 'target_supported_countries', label: 'Target-supported countries only' },
                ]}
              />

              <PolicySelect
                label="Reference policy"
                description="Unreviewed source candidates cannot become reference support."
                value={draft.referencePolicy}
                onChange={(value) => update('referencePolicy', value)}
                options={[
                  {
                    id: 'human_review_before_support_use',
                    label: 'Human review before support use',
                  },
                  { id: 'metadata_planning_only', label: 'Metadata planning only' },
                ]}
              />

              <PolicySelect
                label="Evidence strictness"
                description="Both policies keep candidates distinct from occurrences and labels."
                value={draft.evidenceStrictness}
                onChange={(value) => update('evidenceStrictness', value)}
                options={[
                  { id: 'block_unverified_claims', label: 'Block unverified claims' },
                  { id: 'metadata_exploration_only', label: 'Metadata exploration only' },
                ]}
              />
            </fieldset>

            <fieldset>
              <legend>Budgets and execution</legend>
              <NumberField
                className="mission-field mission-number-field"
                value={draft.maximumApiCalls}
                onChange={(value) => update('maximumApiCalls', value)}
                minValue={1}
                maxValue={evidence.queryPolicy.occurrenceSearchCeiling}
                step={1}
                formatOptions={{ maximumFractionDigits: 0, useGrouping: false }}
              >
                <Label>Maximum API calls</Label>
                <Group>
                  <Button slot="decrement" aria-label="Decrease maximum API calls">−</Button>
                  <Input />
                  <Button slot="increment" aria-label="Increase maximum API calls">+</Button>
                </Group>
                <Text slot="description">
                  Replay baseline: {evidence.budgets.materializedRequestCount} requests. Hard ceiling:{' '}
                  {evidence.queryPolicy.occurrenceSearchCeiling.toLocaleString()}.
                </Text>
              </NumberField>

              <NumberField
                className="mission-field mission-number-field"
                value={draft.candidateLimit}
                onChange={(value) => update('candidateLimit', value)}
                minValue={1}
                maxValue={evidence.candidatePolicy.candidateCount}
                step={1}
                formatOptions={{ maximumFractionDigits: 0, useGrouping: false }}
              >
                <Label>Candidate limit</Label>
                <Group>
                  <Button slot="decrement" aria-label="Decrease candidate limit">−</Button>
                  <Input />
                  <Button slot="increment" aria-label="Increase candidate limit">+</Button>
                </Group>
                <Text slot="description">
                  The fixture declares {evidence.candidatePolicy.candidateCount} regional candidate
                  hypotheses.
                </Text>
              </NumberField>

              <RadioGroup
                className="mission-field mission-mode"
                value={draft.mode}
                onChange={(value) => update('mode', value as MissionMode)}
              >
                <Label>Replay or live mode</Label>
                <Radio value="replay">Replay committed evidence</Radio>
                <Radio value="live" isDisabled>
                  Live work unavailable in the submitted build
                </Radio>
                <Text slot="description">
                  Live work needs explicit approval and infrastructure that this static client does
                  not have.
                </Text>
              </RadioGroup>

              <TextField
                className="mission-field"
                value={draft.device}
                onChange={(value) => update('device', value)}
              >
                <Label>Optional device</Label>
                <Input placeholder="e.g. external GPU computer" />
                <Text slot="description">
                  Planning annotation only. Entering a device does not schedule or contact it.
                </Text>
              </TextField>
            </fieldset>

            <div className="mission-form__actions">
              <Button type="button" onPress={() => setDraft(baseline)}>
                Restore replay baseline
              </Button>
              <p aria-live="polite">
                Deterministic plan generation is the next gated step; no work launches here.
              </p>
            </div>
          </Form>

          {!targetMatchesBundle && (
            <EvidenceState state="blocked" title="No matching verified fixture">
              The draft target differs from {target.scientificName}. Only the submitted target has a
              checksum-verified replay bundle.
            </EvidenceState>
          )}
        </section>

        <aside className="mission-card mission-draft" aria-labelledby="draft-summary-title">
          <p className="eyebrow">Current draft</p>
          <h3 id="draft-summary-title">Guardrails at a glance</h3>
          <dl>
            <div>
              <dt>Region</dt>
              <dd>{draft.region === 'global' ? 'Global range plan' : draft.region}</dd>
            </div>
            <div>
              <dt>Retrieval</dt>
              <dd>{humanize(draft.retrievalPolicy)}</dd>
            </div>
            <div>
              <dt>API-call cap</dt>
              <dd>{draft.maximumApiCalls.toLocaleString()}</dd>
            </div>
            <div>
              <dt>Candidate limit</dt>
              <dd>{draft.candidateLimit}</dd>
            </div>
            <div>
              <dt>Reference use</dt>
              <dd>{humanize(draft.referencePolicy)}</dd>
            </div>
            <div>
              <dt>Mode</dt>
              <dd>{draft.mode}</dd>
            </div>
          </dl>
        </aside>
      </div>

      <section className="mission-card mission-baseline" aria-labelledby="query-hierarchy-title">
        <p className="eyebrow">Verified replay baseline</p>
        <h3 id="query-hierarchy-title">Query hierarchy</h3>
        <ol className="query-hierarchy">
          <li>
            <span>01</span>
            <strong>Target identity</strong>
            <small>{target.scientificName} · {target.acceptedTaxonKey}</small>
          </li>
          <li>
            <span>02</span>
            <strong>Range planning</strong>
            <small>{evidence.regions.length} regions · {countryCount} country entries</small>
          </li>
          <li>
            <span>03</span>
            <strong>Registry-linked taxa</strong>
            <small>{evidence.queryPolicy.queriedSpeciesCount} species identities</small>
          </li>
          <li>
            <span>04</span>
            <strong>Physical queries</strong>
            <small>{evidence.queryPolicy.queryCount} committed definitions</small>
          </li>
          <li>
            <span>05</span>
            <strong>Cluster assignment</strong>
            <small>{humanize(evidence.queryPolicy.defaultRetrievalPolicy)}</small>
          </li>
        </ol>
      </section>

      <div className="mission-evidence-grid">
        <section className="mission-card" aria-labelledby="candidate-policy-title">
          <p className="eyebrow">Candidate policy</p>
          <h3 id="candidate-policy-title">Regional comparison hypotheses</h3>
          <p>
            {evidence.candidatePolicy.candidateCount} candidates;{' '}
            {evidence.candidatePolicy.minimumPerSpecies}–
            {evidence.candidatePolicy.maximumPerSpecies} planned source items per species.
          </p>
          <ul className="candidate-policy-list">
            {evidence.candidatePolicy.candidates.map((candidate) => (
              <li key={candidate.acceptedTaxonKey}>
                <i>{candidate.scientificName}</i>
                <small>{candidate.acceptedTaxonKey}</small>
              </li>
            ))}
          </ul>
          <p className="mission-caveat">Candidates are not labels, occurrences, or verified support.</p>
        </section>

        <section className="mission-card" aria-labelledby="reference-policy-title">
          <p className="eyebrow">Reference requirements</p>
          <h3 id="reference-policy-title">Trust before support</h3>
          <dl className="mission-metrics">
            <div>
              <dt>Eligible source candidates</dt>
              <dd>{evidence.referenceRequirements.eligibleSourceMediaCount}</dd>
            </div>
            <div>
              <dt>Human verified</dt>
              <dd>{evidence.referenceRequirements.humanVerifiedSourceMediaCount}</dd>
            </div>
            <div>
              <dt>Source shortfall</dt>
              <dd>{evidence.referenceRequirements.sourceCandidateShortfall}</dd>
            </div>
            <div>
              <dt>Human-review shortfall</dt>
              <dd>{evidence.referenceRequirements.humanVerifiedShortfall}</dd>
            </div>
          </dl>
          <p className="mission-caveat">
            Ground truth policy: {humanize(evidence.queryPolicy.groundTruthPolicy)}.
          </p>
        </section>

        <section className="mission-card" aria-labelledby="stopping-title">
          <p className="eyebrow">Stopping conditions</p>
          <h3 id="stopping-title">The mission must stop when evidence is incomplete</h3>
          <ul className="mission-condition-list">
            <li>Human review is required before any source candidate is used as support.</li>
            <li>
              Phase 15 authorization is{' '}
              {evidence.stoppingConditions.phase15Authorized ? 'available' : 'blocked'} pending{' '}
              {evidence.stoppingConditions.requiredEvidence.length} required evidence gates.
            </li>
            <li>
              Large YOLOE and BioCLIP runs require a different computer; local verification is capped
              at {evidence.budgets.localBuildVerificationMaxImages} images.
            </li>
            <li>API work stops at the draft cap of {draft.maximumApiCalls.toLocaleString()} calls.</li>
          </ul>
        </section>

        <section className="mission-card mission-card--blocked" aria-labelledby="prerequisites-title">
          <p className="eyebrow">Missing prerequisites</p>
          <h3 id="prerequisites-title">Live scientific work is not ready</h3>
          <ul className="mission-prerequisite-list">
            {incompleteGates.map((gate) => (
              <li key={gate.gateId}>
                <strong>{humanize(gate.gateId)}</strong>
                <span>{humanize(gate.status)}</span>
                <small>
                  {gate.requiredArtifactCount > 0
                    ? `${gate.requiredArtifactCount} required artifacts`
                    : `Computer: ${humanize(gate.requiredComputer ?? 'not declared')}`}
                </small>
              </li>
            ))}
            {evidence.referenceRequirements.unresolvedGroups.map((group) => (
              <li key={group.name}>
                <strong>{humanize(group.name)}</strong>
                <span>{humanize(group.status)}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </section>
  )
}
