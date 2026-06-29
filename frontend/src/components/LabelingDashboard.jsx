import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { apiService } from '../services/api'

// Small labelled stat used in the dashboard header.
function Stat({ label, value }) {
  return (
    <div className="text-center">
      <div className="text-[22px] font-serif text-ink leading-none">{value ?? '—'}</div>
      <div className="mt-1 text-[10px] uppercase tracking-[0.22em] text-sand-faint">{label}</div>
    </div>
  )
}

function TagChip({ children }) {
  return (
    <span className="inline-block rounded-full border border-sand-line px-2.5 py-0.5 text-[12px] text-sand-soft">
      {children}
    </span>
  )
}

function SuggestionCard({ s, busy, onApprove, onReject }) {
  const img = s.image_detail || {}
  const thumb = img.thumbnail_square_640 || img.image_file
  return (
    <div className="flex gap-4 border border-sand-line rounded-lg bg-white/60 p-4">
      <div className="w-28 h-28 shrink-0 overflow-hidden rounded bg-sand-line/40">
        {thumb ? (
          <img src={thumb} alt={img.title || 'photo'} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-[11px] text-sand-faint">no preview</div>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-sand-faint">
          <span>{s.source}</span>
          {s.confidence != null && <span>· conf {s.confidence}</span>}
          {img.title ? <span className="truncate">· was “{img.title}”</span> : null}
        </div>

        {s.suggested_title && (
          <div className="mt-1 font-serif text-[18px] text-ink truncate">{s.suggested_title}</div>
        )}
        {s.suggested_description && (
          <p className="mt-1 text-[13px] text-sand-soft line-clamp-3">{s.suggested_description}</p>
        )}
        {s.suggested_tags?.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {s.suggested_tags.map((t) => <TagChip key={t}>{t}</TagChip>)}
          </div>
        )}
        {s.rationale && (
          <p className="mt-2 text-[12px] italic text-sand-faint line-clamp-2">{s.rationale}</p>
        )}

        <div className="mt-3 flex gap-2">
          <button
            onClick={() => onApprove(s.id)}
            disabled={!!busy}
            className="rounded-full bg-terracotta px-4 py-1.5 text-[13px] text-white disabled:opacity-50 hover:opacity-90 transition"
          >
            {busy === s.id ? '…' : 'Approve'}
          </button>
          <button
            onClick={() => onReject(s.id)}
            disabled={!!busy}
            className="rounded-full border border-sand-line px-4 py-1.5 text-[13px] text-sand-soft disabled:opacity-50 hover:text-ink transition"
          >
            Reject
          </button>
          {img.id && (
            <Link
              to={`/image/${img.id}`}
              className="ml-auto self-center text-[12px] text-sand-faint hover:text-ink transition"
            >
              View photo →
            </Link>
          )}
        </div>
      </div>
    </div>
  )
}

function ReviewTab({ onChange }) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(null)
  const [error, setError] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const { data } = await apiService.listLabelSuggestions('pending', 200)
      setItems(data.results || [])
    } catch (e) {
      setError('Could not load suggestions.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const act = async (id, kind) => {
    setBusy(id)
    try {
      if (kind === 'approve') await apiService.approveLabelSuggestion(id)
      else await apiService.rejectLabelSuggestion(id)
      setItems((prev) => prev.filter((s) => s.id !== id))
      onChange?.()
    } catch (e) {
      setError('Action failed — please retry.')
    } finally {
      setBusy(null)
    }
  }

  if (loading) return <p className="text-sand-faint py-12 text-center">Loading suggestions…</p>
  if (error) return <p className="text-terracotta py-12 text-center">{error}</p>
  if (!items.length) {
    return (
      <div className="py-16 text-center">
        <p className="font-serif text-[20px] text-sand-soft">No pending suggestions</p>
        <p className="mt-2 text-[13px] text-sand-faint">Run a task to generate some, then review them here.</p>
      </div>
    )
  }

  return (
    <>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-[13px] text-sand-soft">{items.length} pending</p>
        <button onClick={load} className="text-[12px] text-sand-faint hover:text-ink transition">Refresh</button>
      </div>
      <div className="grid gap-3">
        {items.map((s) => (
          <SuggestionCard key={s.id} s={s} busy={busy}
            onApprove={(id) => act(id, 'approve')} onReject={(id) => act(id, 'reject')} />
        ))}
      </div>
    </>
  )
}

export default function LabelingDashboard() {
  const [tab, setTab] = useState('review')
  const [stats, setStats] = useState(null)

  const loadStats = useCallback(async () => {
    try {
      const { data } = await apiService.getLabelingStats()
      setStats(data)
    } catch (e) { /* header stats are best-effort */ }
  }, [])
  useEffect(() => { loadStats() }, [loadStats])

  return (
    <div className="min-h-screen bg-cream text-ink font-sans flex flex-col">
      <header className="sticky top-0 z-20 bg-cream/[.92] supports-[backdrop-filter]:backdrop-blur-md border-b border-sand-line">
        <div className="max-w-shell mx-auto flex items-center justify-between px-6 md:px-12 py-[18px]">
          <Link to="/" className="text-[12px] uppercase tracking-[0.26em] text-sand-soft hover:text-ink transition">
            ← Gallery
          </Link>
          <div className="text-[12px] font-medium uppercase tracking-[0.26em] text-sand-soft">AI Labeling</div>
        </div>
      </header>

      <main className="flex-1 max-w-shell w-full mx-auto px-6 md:px-12 py-8">
        {/* Stats */}
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-4 border border-sand-line rounded-lg bg-white/50 px-6 py-5">
          <Stat label="Pending" value={stats?.pending_suggestions} />
          <Stat label="Caption queue" value={stats?.caption_queue} />
          <Stat label="Match queue" value={stats?.match_candidates} />
          <Stat label="Dup queue" value={stats?.propagate_candidates} />
          <Stat label="Known people" value={stats?.known_people} />
          <Stat label="Photos" value={stats?.images_total} />
        </div>
        {stats && !stats.anthropic_configured && (
          <p className="mt-3 text-[12px] text-terracotta">
            Note: ANTHROPIC_API_KEY isn’t set on the server — captions and people-matching are unavailable
            (tag propagation still works).
          </p>
        )}

        {/* Tabs */}
        <div className="mt-8 flex gap-6 border-b border-sand-line">
          {[['review', 'Review'], ['run', 'Run tasks']].map(([key, label]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`pb-3 text-[13px] tracking-wide transition -mb-px border-b-2 ${
                tab === key ? 'border-terracotta text-ink' : 'border-transparent text-sand-faint hover:text-ink'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="mt-6">
          {tab === 'review' ? (
            <ReviewTab onChange={loadStats} />
          ) : (
            <p className="py-16 text-center text-sand-faint">Task runners are coming in the next update.</p>
          )}
        </div>
      </main>
    </div>
  )
}
