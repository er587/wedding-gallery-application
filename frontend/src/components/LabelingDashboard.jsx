import { useState, useEffect, useCallback, useRef } from 'react'
import { Link } from 'react-router-dom'
import { apiService } from '../services/api'

// Turn the per-batch `detail[]` rows into one-line log entries (shape varies by task).
function formatDetail(d) {
  if (d.error) return `#${d.image} — error: ${d.error}`
  if (d.matches) return `#${d.image} → ${d.matches.join(', ') || 'no match'}`
  if (d.title) return `#${d.image} → “${d.title}”${d.tags?.length ? ' [' + d.tags.join(', ') + ']' : ''}`
  if (d.tags) return `#${d.image} → ${d.tags.join(', ')}${d.distance != null ? ' (dist ' + d.distance + ')' : ''}`
  return `#${d.image}`
}

// Drop blanks and coerce types so we never POST e.g. max_tags="".
function cleanOpts(opts, fields) {
  const out = {}
  for (const f of fields) {
    const v = opts[f.key]
    if (f.type === 'checkbox') out[f.key] = !!v
    else if (v === '' || v == null) continue
    else if (f.type === 'number') out[f.key] = Number(v)
    else out[f.key] = v
  }
  return out
}

// One self-contained runner card: options form + client-driven loop + progress.
function TaskRunner({ title, blurb, runFn, fields, defaultOpts, total, disabled, disabledNote, onDone }) {
  const [opts, setOpts] = useState(defaultOpts)
  const [running, setRunning] = useState(false)
  const [progress, setProgress] = useState({ scanned: 0, created: 0 })
  const [log, setLog] = useState([])
  const [error, setError] = useState(null)
  const [finished, setFinished] = useState(false)
  const stopRef = useRef(false)

  const setOpt = (k, v) => setOpts((o) => ({ ...o, [k]: v }))

  const run = async () => {
    setRunning(true); setError(null); setFinished(false); setLog([])
    setProgress({ scanned: 0, created: 0 })
    stopRef.current = false
    const payload = cleanOpts(opts, fields)
    let after = 0, scanned = 0, created = 0
    try {
      for (let guard = 0; guard < 100000; guard++) {
        if (stopRef.current) break
        const { data } = await runFn(after, payload)
        after = data.next_after_id ?? after
        scanned += data.scanned || 0
        created += data.created || 0
        setProgress({ scanned, created })
        if (data.detail?.length) {
          setLog((prev) => [...data.detail.map(formatDetail), ...prev].slice(0, 60))
        }
        if (data.done || (data.scanned || 0) === 0) break
      }
      setFinished(true)
      onDone?.()
    } catch (e) {
      setError(e?.response?.data?.error || 'Run failed — please retry.')
    } finally {
      setRunning(false)
    }
  }

  const pct = total ? Math.min(100, Math.round((progress.scanned / total) * 100)) : null

  return (
    <div className="border border-sand-line rounded-lg bg-white/60 p-5">
      <div className="flex items-baseline justify-between">
        <h3 className="font-serif text-[18px] text-ink">{title}</h3>
        {total != null && <span className="text-[12px] text-sand-faint">{total} to do</span>}
      </div>
      <p className="mt-1 text-[13px] text-sand-soft">{blurb}</p>

      {disabled ? (
        <p className="mt-3 text-[12px] text-terracotta">{disabledNote}</p>
      ) : (
        <>
          <div className="mt-4 flex flex-wrap gap-3">
            {fields.map((f) => (
              <label key={f.key} className="text-[12px] text-sand-soft flex items-center gap-2">
                {f.type === 'checkbox' ? (
                  <>
                    <input type="checkbox" checked={!!opts[f.key]} disabled={running}
                      onChange={(e) => setOpt(f.key, e.target.checked)} />
                    {f.label}
                  </>
                ) : f.type === 'select' ? (
                  <>
                    <span>{f.label}</span>
                    <select
                      value={opts[f.key]} disabled={running}
                      onChange={(e) => setOpt(f.key, e.target.value)}
                      className="rounded border border-sand-line bg-white px-2 py-1 text-ink capitalize"
                    >
                      {(f.options || []).map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                  </>
                ) : (
                  <>
                    <span>{f.label}</span>
                    <input
                      type={f.type} step={f.step} placeholder={f.placeholder} disabled={running}
                      value={opts[f.key]}
                      onChange={(e) => setOpt(f.key, e.target.value)}
                      className="w-24 rounded border border-sand-line bg-white px-2 py-1 text-ink"
                    />
                  </>
                )}
              </label>
            ))}
          </div>

          <div className="mt-4 flex items-center gap-3">
            {!running ? (
              <button onClick={run}
                className="rounded-full bg-terracotta px-5 py-1.5 text-[13px] text-white hover:opacity-90 transition">
                {finished ? 'Run again' : 'Run'}
              </button>
            ) : (
              <button onClick={() => { stopRef.current = true }}
                className="rounded-full border border-sand-line px-5 py-1.5 text-[13px] text-sand-soft hover:text-ink transition">
                Stop
              </button>
            )}
            <span className="text-[12px] text-sand-faint">
              {running ? 'Running…' : finished ? 'Done' : 'Idle'} · scanned {progress.scanned} · created {progress.created}
            </span>
          </div>

          {(running || finished) && (
            <div className="mt-3 h-1.5 w-full rounded-full bg-sand-line/50 overflow-hidden">
              <div className={`h-full bg-terracotta transition-all ${pct == null && running ? 'animate-pulse w-1/3' : ''}`}
                style={pct == null ? undefined : { width: `${pct}%` }} />
            </div>
          )}

          {error && <p className="mt-2 text-[12px] text-terracotta">{error}</p>}

          {log.length > 0 && (
            <pre className="mt-3 max-h-40 overflow-auto rounded bg-ink/5 p-3 text-[11px] leading-relaxed text-sand-soft whitespace-pre-wrap">
              {log.join('\n')}
            </pre>
          )}
        </>
      )}
    </div>
  )
}

function RunTab({ stats, onDone }) {
  const provs = stats?.providers || {}
  const providerOptions = Object.entries(provs).filter(([, ok]) => ok).map(([p]) => ({ value: p, label: p }))
  const anyProvider = providerOptions.length > 0
  const defaultProvider = (stats?.default_provider && provs[stats.default_provider])
    ? stats.default_provider : (providerOptions[0]?.value || '')

  const captionFields = [
    ...(providerOptions.length > 1
      ? [{ key: 'provider', label: 'Provider', type: 'select', options: providerOptions }]
      : []),
    { key: 'model', label: 'Model', type: 'text', placeholder: '(provider default)' },
    { key: 'max_tags', label: 'Max tags', type: 'number' },
    { key: 'existing_tags_only', label: 'Existing tags only', type: 'checkbox' },
  ]

  const runners = [
    {
      key: 'captions', title: 'Generate captions',
      blurb: `Write a title & description for photos that still need one.${
        anyProvider ? ` Provider: ${providerOptions.length > 1 ? 'choose below' : defaultProvider}.` : ''}`,
      runFn: apiService.runGenerateBatch, total: stats?.caption_queue,
      disabled: !anyProvider,
      disabledNote: 'Set an API key on the server (ANTHROPIC_API_KEY, OPENAI_API_KEY, or GEMINI_API_KEY).',
      defaultOpts: { provider: defaultProvider, model: '', max_tags: '', existing_tags_only: false },
      fields: captionFields,
    },
    {
      key: 'match', title: 'Match people',
      blurb: 'Find your tagged people in untagged photos and suggest their names.',
      runFn: apiService.runMatchPeople, total: stats?.match_candidates,
      disabled: stats && !stats.matching_configured,
      disabledNote: 'People-matching needs ANTHROPIC_API_KEY on the server.',
      defaultOpts: { model: '', min_confidence: 0.6, refs_per_person: 2 },
      fields: [
        { key: 'model', label: 'Model', type: 'text', placeholder: '(server default)' },
        { key: 'min_confidence', label: 'Min conf', type: 'number', step: 0.05 },
        { key: 'refs_per_person', label: 'Refs/person', type: 'number' },
      ],
    },
    {
      key: 'propagate', title: 'Propagate to duplicates',
      blurb: 'Copy tags from a tagged photo to its near-identical shots (no API cost).',
      runFn: apiService.runPropagate, total: stats?.propagate_candidates,
      disabled: false,
      defaultOpts: { max_distance: 8 },
      fields: [{ key: 'max_distance', label: 'Max distance', type: 'number' }],
    },
  ]

  return (
    <div className="grid gap-4">
      <p className="text-[12px] text-sand-faint">
        Runs happen in your browser in small batches — keep this tab open. Results land in the Review tab as
        pending suggestions to approve.
      </p>
      {runners.map((r) => <TaskRunner key={r.key} {...r} onDone={onDone} />)}
    </div>
  )
}

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

function PromptEditor({ label, hint, value, onChange, defaultText }) {
  const usingDefault = !value?.trim()
  return (
    <div className="border border-sand-line rounded-lg bg-white/60 p-5">
      <div className="flex items-baseline justify-between">
        <h3 className="font-serif text-[18px] text-ink">{label}</h3>
        <span className={`text-[11px] uppercase tracking-[0.18em] ${usingDefault ? 'text-sand-faint' : 'text-terracotta'}`}>
          {usingDefault ? 'Built-in default' : 'Custom'}
        </span>
      </div>
      <p className="mt-1 text-[12px] text-sand-faint">{hint}</p>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={10}
        placeholder="Leave blank to use the built-in default…"
        className="mt-3 w-full rounded border border-sand-line bg-white px-3 py-2 text-[13px] text-ink font-mono leading-relaxed"
      />
      <div className="mt-2 flex gap-3 text-[12px]">
        <button onClick={() => onChange(defaultText)} className="text-sand-soft hover:text-ink transition">
          Load default into editor
        </button>
        {!usingDefault && (
          <button onClick={() => onChange('')} className="text-sand-faint hover:text-terracotta transition">
            Clear (use default)
          </button>
        )}
      </div>
    </div>
  )
}

function PromptsTab() {
  const [data, setData] = useState(null)
  const [caption, setCaption] = useState('')
  const [match, setMatch] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState(null)

  const load = useCallback(async () => {
    try {
      const { data } = await apiService.getLabelingPrompts()
      setData(data)
      setCaption(data.caption_prompt || '')
      setMatch(data.match_prompt || '')
    } catch (e) {
      setError('Could not load prompts.')
    }
  }, [])
  useEffect(() => { load() }, [load])

  const save = async () => {
    setSaving(true); setError(null); setSaved(false)
    try {
      const { data: d } = await apiService.updateLabelingPrompts({ caption_prompt: caption, match_prompt: match })
      setData(d); setCaption(d.caption_prompt || ''); setMatch(d.match_prompt || '')
      setSaved(true); setTimeout(() => setSaved(false), 2500)
    } catch (e) {
      setError('Save failed — please retry.')
    } finally {
      setSaving(false)
    }
  }

  if (!data) return <p className="text-sand-faint py-12 text-center">Loading prompts…</p>

  const dirty = caption !== (data.caption_prompt || '') || match !== (data.match_prompt || '')

  return (
    <div className="grid gap-4">
      <p className="text-[12px] text-sand-faint">
        Edit the instructions the AI follows. Leave a box blank to use the built-in default. Changes apply to the
        next run — no redeploy needed.
      </p>
      <PromptEditor
        label="Caption prompt"
        hint="Controls tone and rules for Generate captions."
        value={caption} onChange={setCaption} defaultText={data.caption_default}
      />
      <PromptEditor
        label="People-matching prompt"
        hint="Controls how Match people decides who appears in a photo."
        value={match} onChange={setMatch} defaultText={data.match_default}
      />
      <div className="flex items-center gap-3">
        <button
          onClick={save} disabled={saving || !dirty}
          className="rounded-full bg-terracotta px-5 py-1.5 text-[13px] text-white disabled:opacity-50 hover:opacity-90 transition"
        >
          {saving ? 'Saving…' : 'Save prompts'}
        </button>
        {saved && <span className="text-[12px] text-sand-soft">Saved ✓</span>}
        {dirty && !saving && <span className="text-[12px] text-sand-faint">Unsaved changes</span>}
        {error && <span className="text-[12px] text-terracotta">{error}</span>}
      </div>
    </div>
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
          {[['review', 'Review'], ['run', 'Run tasks'], ['prompts', 'Prompts']].map(([key, label]) => (
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
          {tab === 'review' && <ReviewTab onChange={loadStats} />}
          {tab === 'run' && <RunTab stats={stats} onDone={loadStats} />}
          {tab === 'prompts' && <PromptsTab />}
        </div>
      </main>
    </div>
  )
}
