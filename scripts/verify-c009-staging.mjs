const origin = process.env.KARIYA_SNS_UI_C009_ORIGIN
const endpointList = process.env.KARIYA_SNS_UI_C009_ENDPOINTS
const sessionCookie = process.env.KARIYA_SNS_UI_C009_SESSION_COOKIE
const optional = process.argv.includes('--optional')

const forbiddenPayloadKeys = new Set([
  'service_token',
  'access_token',
  'refresh_token',
  'connector_secret',
  'internal_url',
  'raw_model_trace',
  'model_trace',
  'raw_reasoning',
  'system_prompt',
])

function parseEndpoints(value) {
  if (!value) {
    return []
  }

  return value
    .split(',')
    .map((endpoint) => endpoint.trim())
    .filter(Boolean)
}

function assertSafeOrigin(value) {
  let parsed
  try {
    parsed = new URL(value)
  } catch {
    throw new Error('KARIYA_SNS_UI_C009_ORIGIN must be an absolute URL')
  }

  if (!['https:', 'http:'].includes(parsed.protocol)) {
    throw new Error('KARIYA_SNS_UI_C009_ORIGIN must use http or https')
  }

  return parsed
}

function assertFacadeEndpoint(endpoint) {
  if (!endpoint.startsWith('/platform/c009/')) {
    throw new Error(`${endpoint} is outside the approved /platform/c009 facade`)
  }

  if (endpoint.includes('://')) {
    throw new Error(`${endpoint} must be a same-origin path, not an absolute URL`)
  }
}

function inspectPayload(value, path = '$') {
  if (Array.isArray(value)) {
    value.forEach((item, index) => inspectPayload(item, `${path}[${index}]`))
    return
  }

  if (!value || typeof value !== 'object') {
    return
  }

  for (const [key, nested] of Object.entries(value)) {
    if (forbiddenPayloadKeys.has(key)) {
      throw new Error(`Forbidden internal field '${key}' found at ${path}`)
    }
    inspectPayload(nested, `${path}.${key}`)
  }
}

async function main() {
  const endpoints = parseEndpoints(endpointList)

  if (!origin || endpoints.length === 0) {
    const message = 'C-009 staging verification skipped: set KARIYA_SNS_UI_C009_ORIGIN and KARIYA_SNS_UI_C009_ENDPOINTS to run it.'
    if (optional) {
      console.log(message)
      return
    }
    throw new Error(message)
  }

  const parsedOrigin = assertSafeOrigin(origin)
  endpoints.forEach(assertFacadeEndpoint)

  for (const endpoint of endpoints) {
    const url = new URL(endpoint, parsedOrigin)
    const headers = { accept: 'application/json' }
    if (sessionCookie) {
      headers.cookie = sessionCookie
    }

    const response = await fetch(url, {
      headers,
      redirect: 'manual',
    })

    if (!response.ok) {
      throw new Error(`${endpoint} returned ${response.status}`)
    }

    const contentType = response.headers.get('content-type') ?? ''
    if (!contentType.includes('application/json')) {
      throw new Error(`${endpoint} returned non-JSON content-type: ${contentType || 'missing'}`)
    }

    const payload = await response.json()
    inspectPayload(payload)
    console.log(`${endpoint} passed`)
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
