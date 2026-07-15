const FIXTURE_PREFIX = '../../../../demo/fixture/papilio_pilot/'

const fixtureModules = import.meta.glob<string>(
  '../../../../demo/fixture/papilio_pilot/**/*.json',
  {
    eager: true,
    import: 'default',
    query: '?raw',
  },
)

export const committedFixtureFiles: Readonly<Record<string, string>> = Object.freeze(
  Object.fromEntries(
    Object.entries(fixtureModules).map(([path, contents]) => [
      path.replace(FIXTURE_PREFIX, ''),
      contents,
    ]),
  ),
)

export const committedJudgeBundle = JSON.parse(
  committedFixtureFiles['judge_bundle.json'] ?? '{}',
) as Record<string, unknown>

export function createCommittedFixtureFetcher(
  overrides: Readonly<Record<string, string | Uint8Array<ArrayBuffer>>> = {},
): typeof fetch {
  return async (input) => {
    const url =
      input instanceof Request
        ? new URL(input.url)
        : new URL(input instanceof URL ? input.href : input, window.location.href)
    const path = [...new Set([...Object.keys(committedFixtureFiles), ...Object.keys(overrides)])].find(
      (candidate) => url.pathname === `/${candidate}` || url.pathname.endsWith(`/${candidate}`),
    )
    if (path === undefined) {
      return new Response(null, { status: 404 })
    }
    const body = overrides[path] ?? committedFixtureFiles[path]
    if (body === undefined) {
      return new Response(null, { status: 404 })
    }
    return new Response(body, {
      status: 200,
      headers: { 'content-type': path.endsWith('.json') ? 'application/json' : 'application/octet-stream' },
    })
  }
}

export function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}
