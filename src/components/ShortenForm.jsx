import { useState } from 'react'
import { Scissors } from 'lucide-react'
import { shorten, buildShortUrl, ShortenerError } from '@/lib/shortener.js'
import CopyButton from '@/components/CopyButton.jsx'

const EXPIRY_OPTIONS = [
  { label: 'Never expires', value: '' },
  { label: 'Expires in 1 day', value: '1' },
  { label: 'Expires in 7 days', value: '7' },
  { label: 'Expires in 30 days', value: '30' },
]

export default function ShortenForm({ onChange }) {
  const [input, setInput] = useState('')
  const [expiry, setExpiry] = useState('')
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)

  function handleSubmit(event) {
    event.preventDefault()
    setError(null)
    setResult(null)
    try {
      const entry = shorten(input, {
        expiresInDays: expiry ? Number(expiry) : null,
      })
      setResult(entry)
      onChange()
    } catch (err) {
      setError(
        err instanceof ShortenerError ? err.message : 'Something went wrong.',
      )
    }
  }

  const shortUrl = result ? buildShortUrl(result.code) : null

  return (
    <section className="panel">
      <h2>Shorten a URL</h2>
      <form onSubmit={handleSubmit}>
        <input
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder="https://example.com/very/long/link"
          aria-label="Long URL"
        />
        <select
          value={expiry}
          onChange={(event) => setExpiry(event.target.value)}
          aria-label="Expiration"
        >
          {EXPIRY_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <button type="submit">
          <Scissors size={16} />
          Shorten
        </button>
      </form>

      {error && <p className="error">{error}</p>}

      {result && (
        <div className="result">
          <a href={shortUrl}>{shortUrl}</a>
          <CopyButton text={shortUrl} />
          {result.reused && (
            <span className="hint">
              This URL was already shortened, so you get the same code back.
            </span>
          )}
        </div>
      )}
    </section>
  )
}
