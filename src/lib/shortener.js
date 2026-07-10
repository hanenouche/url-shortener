// Core shortener logic, no React in here so it stays easy to unit test.
// Everything persists to localStorage under one key, shaped as
// Record<code, LinkEntry>.

/**
 * @typedef {Object} LinkEntry
 * @property {string} code
 * @property {string} longUrl
 * @property {number} createdAt epoch ms
 * @property {number | null} expiresAt epoch ms, null = never expires
 * @property {number} clicks
 * @property {number | null} lastAccessedAt
 */

/** @typedef {LinkEntry & { expired: boolean }} LinkEntryWithStatus */

/** @typedef {keyof typeof ERRORS} ErrorCode */

const STORAGE_KEY = 'url-shortener:links'
const ALPHABET =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
const CODE_LENGTH = 7
const MAX_COLLISION_RETRIES = 5
const MS_PER_DAY = 24 * 60 * 60 * 1000

export const ERRORS = /** @type {const} */ ({
  INVALID_URL: 'INVALID_URL',
  NOT_FOUND: 'NOT_FOUND',
  EXPIRED: 'EXPIRED',
})

export class ShortenerError extends Error {
  /**
   * @param {ErrorCode} code
   * @param {string} message
   */
  constructor(code, message) {
    super(message)
    this.name = 'ShortenerError'
    this.code = code
  }
}

// storage helpers

/** @returns {Record<string, LinkEntry>} */
function load() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null') ?? {}
  } catch {
    // corrupted storage shouldn't crash the app
    return {}
  }
}

/** @param {Record<string, LinkEntry>} store */
function save(store) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(store))
}

/**
 * Random base62, crypto source so codes aren't guessable like sequential ids.
 * Bytes >= 248 are dropped to keep the distribution uniform (256 % 62 != 0).
 * @param {number} [length]
 * @returns {string}
 */
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

/**
 * @param {string} input
 * @returns {string} absolute http(s) href
 */
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

/**
 * Accepts "aB3xY9k", "#/aB3xY9k" or a full short URL.
 * @param {string} input
 * @returns {string | null}
 */
export function extractCode(input) {
  const raw = String(input ?? '').trim()
  if (!raw) return null

  const hashMatch = raw.match(/#\/([A-Za-z0-9]+)\/?\s*$/)
  if (hashMatch) return hashMatch[1]

  if (/^[A-Za-z0-9]+$/.test(raw)) return raw

  const segmentMatch = raw.match(/\/([A-Za-z0-9]+)\/?$/)
  return segmentMatch ? segmentMatch[1] : null
}

/** @param {LinkEntry} entry */
function isExpired(entry) {
  return entry.expiresAt !== null && Date.now() > entry.expiresAt
}

/**
 * Same long URL returns its existing code instead of a new one.
 * @param {string} input
 * @param {{ expiresInDays?: number | null }} [options]
 * @returns {LinkEntry & { reused: boolean }}
 */
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

/**
 * Counts as an access (clicks + 1).
 * @param {string} input code, "#/code" or full short URL
 * @returns {LinkEntry}
 */
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
      `This link expired on ${new Date(entry.expiresAt ?? 0).toLocaleString()}.`,
    )
  }

  entry.clicks += 1
  entry.lastAccessedAt = Date.now()
  save(store)
  return { ...entry }
}

/**
 * Read-only, does not count an access.
 * @param {string} input
 * @returns {LinkEntryWithStatus}
 */
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

/**
 * Newest first.
 * @returns {LinkEntryWithStatus[]}
 */
export function getAll() {
  return Object.values(load())
    .sort((a, b) => b.createdAt - a.createdAt)
    .map((entry) => ({ ...entry, expired: isExpired(entry) }))
}

/** @param {string} code */
export function remove(code) {
  const store = load()
  delete store[code]
  save(store)
}

// purge every expired entry in one go
export function removeExpired() {
  const store = load()
  for (const code of Object.keys(store)) {
    if (isExpired(store[code])) delete store[code]
  }
  save(store)
}

/**
 * Hash based so it also works on static hosting.
 * @param {string} code
 * @returns {string}
 */
export function buildShortUrl(code) {
  const { origin, pathname } = window.location
  return `${origin}${pathname}#/${code}`
}

/**
 * Storage events only fire in OTHER tabs, so this is cross-tab sync.
 * A null key means localStorage.clear().
 * @param {() => void} callback
 * @returns {() => void} unsubscribe
 */
export function onExternalChange(callback) {
  const handler = /** @param {StorageEvent} event */ (event) => {
    if (event.key === STORAGE_KEY || event.key === null) callback()
  }
  window.addEventListener('storage', handler)
  return () => window.removeEventListener('storage', handler)
}
