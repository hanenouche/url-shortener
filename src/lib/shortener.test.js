import { beforeEach, describe, expect, it } from 'vitest'
import {
  shorten,
  resolve,
  getStats,
  getAll,
  remove,
  extractCode,
  buildShortUrl,
  onExternalChange,
  ERRORS,
  ShortenerError,
} from '@/lib/shortener.js'

// the module only needs localStorage and window.location, plain node is enough
function makeStorageMock() {
  let data = {}
  return {
    getItem: (key) => (key in data ? data[key] : null),
    setItem: (key, value) => {
      data[key] = String(value)
    },
  }
}

beforeEach(() => {
  globalThis.localStorage = makeStorageMock()
  globalThis.window = {
    location: { origin: 'http://localhost:5173', pathname: '/' },
  }
})

describe('shorten', () => {
  it('generates a 7 character base62 code', () => {
    const entry = shorten('https://example.com/some/long/path?q=1')
    expect(entry.code).toMatch(/^[A-Za-z0-9]{7}$/)
  })

  it('starts with zero clicks and no expiry by default', () => {
    const entry = shorten('https://example.com/a')
    expect(entry.clicks).toBe(0)
    expect(entry.expiresAt).toBeNull()
    expect(entry.reused).toBe(false)
  })

  it('returns the same code when the same URL is shortened twice', () => {
    const first = shorten('https://example.com/same')
    const second = shorten('https://example.com/same')
    expect(second.code).toBe(first.code)
    expect(second.reused).toBe(true)
  })

  it('assumes https when the scheme is missing', () => {
    const entry = shorten('example.org/page')
    expect(entry.longUrl).toBe('https://example.org/page')
  })

  it('sets expiresAt when expiresInDays is given', () => {
    const entry = shorten('https://example.com/exp', { expiresInDays: 7 })
    const sevenDays = 7 * 24 * 60 * 60 * 1000
    expect(entry.expiresAt).toBeGreaterThan(Date.now())
    expect(entry.expiresAt).toBeLessThanOrEqual(Date.now() + sevenDays)
  })

  it('rejects an invalid URL', () => {
    expect(() => shorten('not a url')).toThrowError(ShortenerError)
    try {
      shorten('not a url')
    } catch (err) {
      expect(err.code).toBe(ERRORS.INVALID_URL)
    }
  })

  it('rejects empty input', () => {
    expect(() => shorten('')).toThrowError(ShortenerError)
    expect(() => shorten('   ')).toThrowError(ShortenerError)
  })

  it('rejects non-web schemes like javascript:', () => {
    expect(() => shorten('javascript:alert(1)')).toThrowError(ShortenerError)
    expect(() => shorten('file:///etc/passwd')).toThrowError(ShortenerError)
  })

  it('applies the newly chosen expiry when reusing a code', () => {
    const first = shorten('https://example.com/reuse-expiry')
    expect(first.expiresAt).toBeNull()
    const second = shorten('https://example.com/reuse-expiry', {
      expiresInDays: 7,
    })
    expect(second.code).toBe(first.code)
    expect(second.expiresAt).not.toBeNull()
  })

  it('gives distinct codes to distinct URLs', () => {
    const codes = new Set()
    for (let i = 0; i < 200; i++) {
      codes.add(shorten(`https://example.com/page/${i}`).code)
    }
    expect(codes.size).toBe(200)
  })
})

describe('resolve', () => {
  it('returns the original URL and counts the access', () => {
    const { code } = shorten('https://example.com/target')
    const entry = resolve(code)
    expect(entry.longUrl).toBe('https://example.com/target')
    expect(entry.clicks).toBe(1)
  })

  it('accepts a full short URL, not just the code', () => {
    const { code } = shorten('https://example.com/full')
    const entry = resolve(`http://localhost:5173/#/${code}`)
    expect(entry.longUrl).toBe('https://example.com/full')
  })

  it('throws NOT_FOUND for an unknown code', () => {
    try {
      resolve('zzzzzzz')
      expect.unreachable('should have thrown')
    } catch (err) {
      expect(err.code).toBe(ERRORS.NOT_FOUND)
    }
  })

  it('does not leak Object.prototype properties as entries', () => {
    // store is a plain JSON.parse object, so store["constructor"] is truthy
    for (const name of ['constructor', 'toString', 'valueOf']) {
      try {
        resolve(name)
        expect.unreachable('should have thrown')
      } catch (err) {
        expect(err.code).toBe(ERRORS.NOT_FOUND)
      }
    }
  })

  it('throws EXPIRED for an expired link and stops counting', () => {
    // negative expiry puts the deadline in the past
    const { code } = shorten('https://example.com/old', { expiresInDays: -1 })
    try {
      resolve(code)
      expect.unreachable('should have thrown')
    } catch (err) {
      expect(err.code).toBe(ERRORS.EXPIRED)
    }
    expect(getStats(code).clicks).toBe(0)
  })
})

describe('getStats', () => {
  it('rejects empty input', () => {
    expect(() => getStats('')).toThrowError(ShortenerError)
  })

  it('reads stats without counting as an access', () => {
    const { code } = shorten('https://example.com/stats')
    resolve(code)
    expect(getStats(code).clicks).toBe(1)
    expect(getStats(code).clicks).toBe(1)
  })
})

describe('getAll', () => {
  it('flags expired entries and keeps them listed', () => {
    shorten('https://example.com/live')
    const dead = shorten('https://example.com/dead', { expiresInDays: -1 })
    const all = getAll()
    expect(all).toHaveLength(2)
    expect(all.find((e) => e.code === dead.code).expired).toBe(true)
  })
})

describe('remove', () => {
  it('deletes the mapping', () => {
    const { code } = shorten('https://example.com/gone')
    remove(code)
    expect(() => resolve(code)).toThrowError(ShortenerError)
  })
})

describe('extractCode', () => {
  it('handles bare codes, hash fragments and full URLs', () => {
    expect(extractCode('aB3xY9k')).toBe('aB3xY9k')
    expect(extractCode('  aB3xY9k  ')).toBe('aB3xY9k')
    expect(extractCode('#/aB3xY9k')).toBe('aB3xY9k')
    expect(extractCode('http://localhost:5173/#/aB3xY9k')).toBe('aB3xY9k')
    expect(extractCode('')).toBeNull()
  })
})

describe('buildShortUrl', () => {
  it('builds a hash URL on the current origin', () => {
    expect(buildShortUrl('abc')).toBe('http://localhost:5173/#/abc')
  })
})

describe('onExternalChange', () => {
  it('fires only for our storage key (or a full clear)', () => {
    const listeners = {}
    globalThis.window.addEventListener = (type, fn) => {
      listeners[type] = fn
    }
    globalThis.window.removeEventListener = () => {}

    let calls = 0
    const off = onExternalChange(() => calls++)
    listeners.storage({ key: 'url-shortener:links' })
    listeners.storage({ key: 'some-other-app' })
    listeners.storage({ key: null }) // localStorage.clear()
    expect(calls).toBe(2)
    off()
  })
})
