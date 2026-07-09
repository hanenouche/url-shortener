import { useEffect, useState } from 'react'

// "#/aB3xY9k" -> short code, anything else -> home
function read() {
  return window.location.hash.match(/^#\/([A-Za-z0-9]+)$/)?.[1] ?? null
}

export function useHashCode() {
  const [code, setCode] = useState(read)

  useEffect(() => {
    const onHashChange = () => setCode(read())
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

  return code
}
