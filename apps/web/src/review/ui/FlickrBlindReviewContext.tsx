import {
  FLICKR_BLIND_HIDDEN_FIELDS,
  flickrBlindHiddenFieldLabel,
  type BlindFlickrReviewContext,
} from '../domain'

export function FlickrBlindReviewContextPanel({
  context,
}: {
  readonly context: BlindFlickrReviewContext
}) {
  return (
    <section
      className="flickr-blind-review"
      aria-labelledby="flickr-blind-review-title"
    >
      <div>
        <p className="eyebrow">Blind Flickr review</p>
        <h3 id="flickr-blind-review-title">{context.targetQuestion}</h3>
        <p role="status">
          Decide from the checksum-verified image and declared visual route.
          Model, search, provider-label, and comment evidence remains concealed
          until after an append-only decision.
        </p>
      </div>
      <dl>
        <div>
          <dt>Campaign purpose</dt>
          <dd>{context.campaignPurpose.replaceAll('_', ' ')}</dd>
        </div>
        <div>
          <dt>Expected route</dt>
          <dd>
            {formatDimension(context.routeExpectation.lifeStage)} ·{' '}
            {formatDimension(context.routeExpectation.visualDomain)} ·{' '}
            {formatDimension(context.routeExpectation.view)} view
          </dd>
        </div>
        <div>
          <dt>Image checksum</dt>
          <dd>
            <code>{context.reviewMedia.imageSha256}</code>
          </dd>
        </div>
        <div>
          <dt>Licence</dt>
          <dd>
            <a
              href={context.attribution.licenseUri}
              target="_blank"
              rel="noreferrer"
            >
              {context.attribution.licenseName}
            </a>
          </dd>
        </div>
      </dl>
      <BlindFlickrReviewBoundary />
    </section>
  )
}

export function BlindFlickrReviewBoundary() {
  return (
    <aside className="flickr-blind-review__boundary">
      <strong>Withheld before decision</strong>
      <ul aria-label="Context withheld during blind Flickr review">
        {FLICKR_BLIND_HIDDEN_FIELDS.map((field) => (
          <li key={field}>{flickrBlindHiddenFieldLabel(field)}</li>
        ))}
      </ul>
      <p>
        The Flickr source page is also unavailable before decision because its
        title, description, tags, or comments could disclose the search label.
      </p>
    </aside>
  )
}

function formatDimension(value: string | null): string {
  return value === null ? 'unspecified' : value.replaceAll('_', ' ')
}
