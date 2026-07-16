import type { VerificationCampaign } from '../domain/verificationContracts'

export function CampaignSelector({
  campaigns,
  disabled = false,
  onSelect,
  selectedCampaignId,
}: {
  readonly campaigns: readonly VerificationCampaign[]
  readonly disabled?: boolean
  readonly onSelect: (campaignId: string) => void
  readonly selectedCampaignId: string
}) {
  return (
    <label className="verification-campaign-selector">
      <span>Verification campaign</span>
      <select
        value={selectedCampaignId}
        disabled={disabled}
        onChange={(event) => onSelect(event.target.value)}
      >
        {campaigns.map((campaign) => (
          <option key={campaign.campaignId} value={campaign.campaignId}>
            {campaign.title}
          </option>
        ))}
      </select>
    </label>
  )
}
