import { useEffect, useState } from 'react'
import { Link2, Moon, Sun } from 'lucide-react'
import ShortenForm from '@/components/ShortenForm.jsx'
import RetrieveForm from '@/components/RetrieveForm.jsx'
import LinksTable from '@/components/LinksTable.jsx'
import RedirectPage from '@/components/RedirectPage.jsx'
import { useHashCode } from '@/hooks/useHashRoute.js'
import { useTheme } from '@/hooks/useTheme.js'
import { getAll, onExternalChange } from '@/lib/shortener.js'
import '@/App.css'

export default function App() {
  const [links, setLinks] = useState(() => getAll())
  const redirectCode = useHashCode()
  const { theme, toggle } = useTheme()

  const refresh = () => setLinks(getAll())

  // another tab changed the store -> refresh the table
  useEffect(() => onExternalChange(() => setLinks(getAll())), [])

  if (redirectCode) return <RedirectPage code={redirectCode} />

  const themeLabel =
    theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'

  return (
    <main className="app">
      <header>
        <div className="brand">
          <span className="logo-badge">
            <Link2 size={22} />
          </span>
          <div>
            <h1>URL Shortener</h1>
            <p className="tagline">
              Paste a long link and get a short one, with click stats and
              optional expiration.
            </p>
          </div>
        </div>
        <button
          type="button"
          className="ghost icon"
          onClick={toggle}
          title={themeLabel}
          aria-label={themeLabel}
        >
          {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
        </button>
      </header>

      <div className="panels">
        <ShortenForm onChange={refresh} />
        <RetrieveForm />
      </div>

      <LinksTable links={links} onChange={refresh} />

      <footer>
        Links are stored locally in your browser (localStorage), no server
        involved.
      </footer>
    </main>
  )
}
