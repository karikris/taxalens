import type { ReplayEvidence } from '../data/evidenceFacade'
import { ScientificFigure } from '../design-system'
import { buildYoloeRoutingEvidence } from './yoloeRoutingModel'

export function YoloeRoutingEvidence({ replay }: { readonly replay: ReplayEvidence }) {
  const model = buildYoloeRoutingEvidence(replay)

  return (
    <section className="yoloe-routing" aria-labelledby="yoloe-routing-title">
      <div className="yoloe-routing__heading">
        <div>
          <p className="eyebrow">Computer-vision routing</p>
          <h3 id="yoloe-routing-title">YOLOE route evidence</h3>
        </div>
        <strong>{model.processedImageCount} images processed</strong>
      </div>

      <p className="yoloe-routing__principle">
        YOLOE routes evidence; it does not identify species.
      </p>

      <ScientificFigure
        title="Original image, detection box, and segmentation mask"
        description="A real overlay would preserve one image coordinate space and keep each box and mask aligned to its detection instance. This replay has no licensed image or YOLOE output to draw."
        caption={`Unavailable: ${model.sectionReason}`}
        tier="unavailable"
      >
        <div
          className="yoloe-routing__canvas"
          role="img"
          aria-label="YOLOE image, detection box, and segmentation mask unavailable"
        >
          <span>No visual input or model overlay is rendered</span>
        </div>
        <ul className="yoloe-routing__layers" aria-label="YOLOE visual layers">
          {model.visualLayers.map((layer) => (
            <li key={layer.id} data-layer={layer.id} data-availability={layer.status}>
              <span className="yoloe-routing__layer-marker" aria-hidden="true" />
              <div>
                <strong>{layer.label}</strong>
                <span>Unavailable</span>
                <small>{layer.reason}</small>
              </div>
            </li>
          ))}
        </ul>
      </ScientificFigure>

      <dl className="yoloe-routing__facts" aria-label="YOLOE routing attributes" role="group">
        {model.routeFields.map((field) => (
          <div key={field.id} data-availability={field.status}>
            <dt>{field.label}</dt>
            <dd>
              <strong>Unavailable</strong>
              <span>{field.reason}</span>
            </dd>
          </div>
        ))}
      </dl>

      <p className="yoloe-routing__boundary">
        Detection prompts and routing metadata are diagnostic inputs to later review. They are not
        taxonomic labels, occurrences, or species identifications.
      </p>
    </section>
  )
}
