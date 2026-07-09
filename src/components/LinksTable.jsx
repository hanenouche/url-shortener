import { Link2, Trash2 } from 'lucide-react'
import { buildShortUrl, remove } from '@/lib/shortener.js'
import CopyButton from '@/components/CopyButton.jsx'

function formatDate(timestamp) {
  return timestamp
    ? new Date(timestamp).toLocaleString(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short',
      })
    : '-'
}

export default function LinksTable({ links, onChange }) {
  if (links.length === 0) {
    return (
      <div className="empty">
        <Link2 size={28} />
        <p>No links yet. Shorten your first URL above.</p>
      </div>
    )
  }

  function handleDelete(code) {
    remove(code)
    onChange()
  }

  return (
    <section>
      <h2>Your links</h2>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Short</th>
              <th>Original URL</th>
              <th>Clicks</th>
              <th>Created</th>
              <th>Expires</th>
              <th aria-label="Actions"></th>
            </tr>
          </thead>
          <tbody>
            {links.map((link) => (
              <tr key={link.code} className={link.expired ? 'expired' : ''}>
                <td data-label="Short">
                  <a href={buildShortUrl(link.code)}>{link.code}</a>
                </td>
                <td className="long-url" data-label="Original URL" title={link.longUrl}>
                  <span>{link.longUrl}</span>
                </td>
                <td data-label="Clicks">{link.clicks}</td>
                <td data-label="Created">{formatDate(link.createdAt)}</td>
                <td data-label="Expires">
                  {link.expired
                    ? 'Expired'
                    : link.expiresAt
                      ? formatDate(link.expiresAt)
                      : 'Never'}
                </td>
                <td className="actions">
                  <CopyButton text={buildShortUrl(link.code)} iconOnly />
                  <button
                    type="button"
                    className="ghost icon danger"
                    onClick={() => handleDelete(link.code)}
                    title="Delete link"
                    aria-label={`Delete ${link.code}`}
                  >
                    <Trash2 size={16} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
