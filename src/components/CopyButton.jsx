import { useEffect, useRef, useState } from 'react'
import { Check, Copy } from 'lucide-react'

export default function CopyButton({ text, iconOnly = false }) {
  const [copied, setCopied] = useState(false)
  const timer = useRef(null)

  useEffect(() => () => clearTimeout(timer.current), [])

  async function copy() {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      timer.current = setTimeout(() => setCopied(false), 1500)
    } catch {
      // clipboard not available (http, older browser), nothing we can do
    }
  }

  return (
    <button
      type="button"
      className={iconOnly ? 'ghost icon' : 'ghost'}
      onClick={copy}
      title="Copy short URL"
      aria-label="Copy short URL"
    >
      {copied ? <Check size={16} /> : <Copy size={16} />}
      {!iconOnly && <span>{copied ? 'Copied!' : 'Copy'}</span>}
    </button>
  )
}
