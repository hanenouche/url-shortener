import { useState } from 'react'
import { MousePointerClick, Search } from 'lucide-react'
import { getStats, ShortenerError } from '@/lib/shortener.js'

export default function RetrieveForm() {
  const [input, setInput] = useState('')
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)

  function handleSubmit(event) {
    event.preventDefault()
    setError(null)
    setResult(null)
    try {
      // read-only lookup: checking a link shouldn't inflate its own stats
      const entry = getStats(input)
      setResult(entry)
    } catch (err) {
      setError(
        err instanceof ShortenerError ? err.message : 'Something went wrong.',
      )
    }
  }

  return (
    <section className="panel">
      <h2>Retrieve a URL</h2>
      <form onSubmit={handleSubmit}>
        <input
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder="Short URL or code, e.g. aB3xY9k"
          aria-label="Short URL or code"
        />
        <button type="submit">
          <Search size={16} />
          Retrieve
        </button>
      </form>

      {error && <p className="error">{error}</p>}

      {result && (
        <div className="result">
          <a href={result.longUrl} target="_blank" rel="noreferrer">
            {result.longUrl}
          </a>
          <span className="hint">
            <MousePointerClick size={14} />
            {result.clicks} access{result.clicks === 1 ? '' : 'es'}
            {result.expired && ' (expired)'}
          </span>
        </div>
      )}
    </section>
  )
}
