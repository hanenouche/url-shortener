import { useEffect, useRef, useState } from 'react'
import { HeartCrack } from 'lucide-react'
import { resolve } from '@/lib/shortener.js'

// resolves #/code and redirects, or shows why it can't
export default function RedirectPage({ code }) {
  const [error, setError] = useState(null)
  const done = useRef(false)

  useEffect(() => {
    // StrictMode runs effects twice in dev, don't count the visit twice
    if (done.current) return
    done.current = true

    try {
      const entry = resolve(code)
      window.location.replace(entry.longUrl)
    } catch (err) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- the redirect is a side effect that can fail, the error has to land in state
      setError(err.message)
    }
  }, [code])

  if (!error) {
    return (
      <main className="app center">
        <p>Redirecting...</p>
      </main>
    )
  }

  return (
    <main className="app center">
      <span className="logo-badge big">
        <HeartCrack size={30} />
      </span>
      <h1>Link unavailable</h1>
      <p className="error">{error}</p>
      <a href="#/">Back to the shortener</a>
    </main>
  )
}
