import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const root = process.cwd()
const sourceRoots = ['src']
const failures = []

const forbiddenTokens = [
  ['kariya-sns', '.', 'internal'].join(''),
  ['kariya-kai', '.', 'internal'].join(''),
  ['raw', 'model', 'trace'].join('_'),
  ['model', 'trace'].join('_'),
  ['raw', 'reasoning'].join('_'),
  ['system', 'prompt'].join('_'),
  ['connector', 'secret'].join('_'),
  ['service', 'token'].join('_'),
  ['access', 'token'].join('_'),
  ['refresh', 'token'].join('_'),
  ['record', 'enforcement'].join('_'),
  ['authorize', 'enforcement'].join('_'),
  ['execute', 'enforcement'].join('_'),
]

const allowedEnvTokens = new Set([['K', 'SNS', 'UPSTREAM', 'ORIGIN'].join('_')])

function walk(dir) {
  const entries = readdirSync(dir)
  for (const entry of entries) {
    const path = join(dir, entry)
    const stats = statSync(path)
    if (stats.isDirectory()) {
      walk(path)
    } else if (/\.(ts|tsx|js|mjs|md|json|css)$/.test(entry)) {
      inspect(path)
    }
  }
}

function inspect(path) {
  const rel = relative(root, path)
  const contents = readFileSync(path, 'utf8')

  for (const token of forbiddenTokens) {
    if (contents.includes(token)) {
      failures.push(`${rel} contains forbidden boundary token: ${token}`)
    }
  }

  if (contents.includes('NEXT_PUBLIC_') && contents.includes('UPSTREAM')) {
    failures.push(`${rel} exposes upstream configuration through NEXT_PUBLIC_*`)
  }

  for (const envToken of allowedEnvTokens) {
    if (contents.includes(envToken) && !rel.endsWith('.env.example')) {
      failures.push(`${rel} references ${envToken}; upstream wiring must stay server-side and out of bootstrap UI code`)
    }
  }
}

for (const dir of sourceRoots) {
  walk(join(root, dir))
}

const envExample = readFileSync(join(root, '.env.example'), 'utf8')
if (!envExample.includes('NEXT_PUBLIC_SNS_API_BASE=/platform/c009')) {
  failures.push('.env.example does not define the browser facade as /platform/c009')
}

if (failures.length) {
  console.error(`Boundary verification failed:\n- ${failures.join('\n- ')}`)
  process.exit(1)
}

console.log('Boundary verification passed')
