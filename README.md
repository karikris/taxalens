# taxalens
Auditable Biodiversity Evidence from Social Media

Development currently requires Python 3.11 or newer and uv 0.11 or newer.
`uv sync` installs the credential-free replay and test environment without
model downloads, GPU libraries, or cloud credentials.

The browser mission planner is deterministic and OpenAI-independent. It fingerprints the complete
evidence plan, displays the pinned BioMiner source-registry version, and can launch only the
checksum-verified submitted fixture. Live scientific work remains unavailable until a separate,
explicit approval exists.

The compact BioMiner import includes the pinned geographic workload settings solely to preserve and
validate the registry contract (`butterflies-v2-20260712`) used by the submitted replay.

Observatory renders the 13 required evidence stages as an accessible ordered pipeline. Every count
comes from the verified fixture, retains its own unit, and keeps unavailable scientific work visibly
distinct from a measured zero.

## Hosted judge replay

Pushes to `main` and manual dispatches build the public GitHub Pages replay with no login, backend,
credentials, or live scientific request. The workflow checks out the exact event commit, installs the
locked web dependencies, verifies the production bundle, and uploads only `dist/web`.

Every hosted artifact publishes `build-fingerprint.json` at the site root. It binds the exact source
SHA and Pages base path to a sorted SHA-256 inventory of every other deployed file, including the
static `404.html` fallback and `.nojekyll` marker. The deployment verifier rejects source drift,
tampering, linked files, or a change to the public and backend-free contract before upload.

To produce the same artifact locally:

```bash
cd apps/web
npm ci
TAXALENS_DEPLOY_BASE_PATH=/taxalens npm run build:deployment
```
