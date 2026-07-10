// Core shortener logic, no React in here so it stays easy to unit test.
//
// localStorage shape, keyed by code:
// { "aB3xY9k": { code, longUrl, createdAt, expiresAt, clicks, lastAccessedAt } }
// expiresAt is null when the link never expires.

const STORAGE_KEY = 'url-shortener:links'
const ALPHABET =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
const CODE_LENGTH = 7
const MAX_COLLISION_RETRIES = 5
const MS_PER_DAY = 24 * 60 * 60 * 1000

export const ERRORS = {
  INVALID_URL: 'INVALID_URL',
  NOT_FOUND: 'NOT_FOUND',
  EXPIRED: 'EXPIRED',
}

export class ShortenerError extends Error {
  constructor(code, message) {
    super(message)
    this.name = 'ShortenerError'
    this.code = code
  }
}

// storage helpers

function load() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) ?? {}
  } catch {
    // corrupted storage shouldn't crash the app
    return {}
  }
}

function save(store) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(store))
}

// random base62, crypto source so codes aren't guessable like sequential ids.
// bytes >= 248 are dropped to keep the distribution uniform (256 % 62 != 0)
function generateCode(length = CODE_LENGTH) {
  const limit = 256 - (256 % ALPHABET.length) // 248
  let code = ''
  while (code.length < length) {
    const bytes = crypto.getRandomValues(new Uint8Array(length * 2))
    for (const byte of bytes) {
      if (byte < limit && code.length < length) {
        code += ALPHABET[byte % ALPHABET.length]
      }
    }
  }
  return code
}

function normalizeUrl(input) {
  const raw = String(input ?? '').trim()
  if (!raw) {
    throw new ShortenerError(ERRORS.INVALID_URL, 'Please enter a URL.')
  }

  // no scheme? assume https
  const hasScheme = /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(raw)
  const candidate = hasScheme ? raw : `https://${raw}`

  let url
  try {
    url = new URL(candidate)
  } catch {
    throw new ShortenerError(ERRORS.INVALID_URL, `"${raw}" is not a valid URL.`)
  }

  // http(s) only, never javascript:/data:/file:
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new ShortenerError(
      ERRORS.INVALID_URL,
      'Only http(s) URLs can be shortened.',
    )
  }

  if (!url.hostname.includes('.') && url.hostname !== 'localhost') {
    throw new ShortenerError(
      ERRORS.INVALID_URL,
      `"${url.hostname}" does not look like a valid host.`,
    )
  }

  return url.href
}

// accepts "aB3xY9k", "#/aB3xY9k" or a full short URL
export function extractCode(input) {
  const raw = String(input ?? '').trim()
  if (!raw) return null

  const hashMatch = raw.match(/#\/([A-Za-z0-9]+)\/?\s*$/)
  if (hashMatch) return hashMatch[1]

  if (/^[A-Za-z0-9]+$/.test(raw)) return raw

  const segmentMatch = raw.match(/\/([A-Za-z0-9]+)\/?$/)
  return segmentMatch ? segmentMatch[1] : null
}

function isExpired(entry) {
  return entry.expiresAt !== null && Date.now() > entry.expiresAt
}

// same long URL returns its existing code instead of a new one
export function shorten(input, { expiresInDays = null } = {}) {
  const longUrl = normalizeUrl(input)
  const store = load()

  const existing = Object.values(store).find(
    (entry) => entry.longUrl === longUrl && !isExpired(entry),
  )
  if (existing) {
    // apply the expiry chosen this time instead of silently keeping the old one
    existing.expiresAt = expiresInDays
      ? Date.now() + expiresInDays * MS_PER_DAY
      : null
    save(store)
    return { ...existing, reused: true }
  }

  let code = generateCode()
  let attempts = 0
  // hasOwn, not store[code]: "constructor" etc. would hit Object.prototype
  while (Object.hasOwn(store, code)) {
    attempts += 1
    // 62^7 ~ 3.5 trillion codes so this never loops in practice,
    // but retry anyway and go to 8 chars if it somehow keeps colliding
    code =
      attempts > MAX_COLLISION_RETRIES
        ? generateCode(CODE_LENGTH + 1)
        : generateCode()
  }

  const entry = {
    code,
    longUrl,
    createdAt: Date.now(),
    expiresAt: expiresInDays ? Date.now() + expiresInDays * MS_PER_DAY : null,
    clicks: 0,
    lastAccessedAt: null,
  }
  store[code] = entry
  save(store)
  return { ...entry, reused: false }
}

// counts as an access (clicks + 1)
export function resolve(input) {
  const code = extractCode(input)
  if (!code) {
    throw new ShortenerError(
      ERRORS.NOT_FOUND,
      'Please enter a short URL or code.',
    )
  }

  const store = load()
  if (!Object.hasOwn(store, code)) {
    throw new ShortenerError(ERRORS.NOT_FOUND, `No link found for "${code}".`)
  }
  const entry = store[code]
  if (isExpired(entry)) {
    throw new ShortenerError(
      ERRORS.EXPIRED,
      `This link expired on ${new Date(entry.expiresAt).toLocaleString()}.`,
    )
  }

  entry.clicks += 1
  entry.lastAccessedAt = Date.now()
  save(store)
  return { ...entry }
}

// read-only, does not count an access
export function getStats(input) {
  const code = extractCode(input)
  if (!code) {
    throw new ShortenerError(
      ERRORS.NOT_FOUND,
      'Please enter a short URL or code.',
    )
  }
  const store = load()
  if (!Object.hasOwn(store, code)) {
    throw new ShortenerError(ERRORS.NOT_FOUND, `No link found for "${code}".`)
  }
  const entry = store[code]
  return { ...entry, expired: isExpired(entry) }
}

// newest first
export function getAll() {
  return Object.values(load())
    .sort((a, b) => b.createdAt - a.createdAt)
    .map((entry) => ({ ...entry, expired: isExpired(entry) }))
}

export function remove(code) {
  const store = load()
  delete store[code]
  save(store)
}

// hash based so it also works on static hosting
export function buildShortUrl(code) {
  const { origin, pathname } = window.location
  return `${origin}${pathname}#/${code}`
}
