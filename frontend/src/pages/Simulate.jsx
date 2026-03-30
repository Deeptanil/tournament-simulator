import { useState, useEffect, useRef } from 'react'
import { getRuns, runSimulation, getProbabilities, getTeams, teamLogoUrl } from '../api'
import { Icons } from '../Icons'

function pColor(v) {
  if (v >= 50) return 'var(--green)'
  if (v >= 15) return 'var(--amber)'
  return 'var(--red)'
}

function ProbBar({ val }) {
  const pct = Math.min(val, 100)
  return (
    <div className="prob-bar-wrap">
      <span style={{ color: pColor(val), fontWeight: 700, minWidth: 44, fontSize: 12 }}>{val}%</span>
      <div className="prob-bar-bg">
        <div className="prob-bar-fill" style={{ width: `${pct}%`, background: pColor(val) }} />
      </div>
    </div>
  )
}

export default function Simulate({ leagueId }) {
  const [runs, setRuns]         = useState([])
  const [results, setResults]   = useState([])
  const [runId, setRunId]       = useState(null)
  const [n, setN]               = useState(10000)
  const [loading, setLoading]   = useState(false)
  const [progress, setProgress] = useState(0)
  const [sortCol, setSortCol]   = useState('p_champion')
  const [sortDir, setSortDir]   = useState('desc')
  const [search, setSearch]     = useState('')
  const [teams, setTeams]       = useState([])
  const progRef = useRef(null)

  useEffect(() => {
    setResults([])
    setTeams([])
    getTeams(leagueId).then(setTeams)
  }, [leagueId])

  useEffect(() => {
    getRuns().then(data => {
      setRuns(data)
      if (data.length > 0) {
        setRunId(data[0].id)
        getProbabilities(data[0].id).then(setResults)
      }
    })
  }, [])

  const handleSort = (col) => {
    if (sortCol === col) setSortDir(d => d === 'desc' ? 'asc' : 'desc')
    else { setSortCol(col); setSortDir('desc') }
  }

  const simulate = async () => {
    setLoading(true)
    setProgress(0)
    setResults([])
    progRef.current = setInterval(() => {
      setProgress(p => Math.min(p + Math.random() * 8, 88))
    }, 100)
    try {
      const { run_id } = await runSimulation(n, leagueId)
      clearInterval(progRef.current)
      setProgress(100)
      const probs = await getProbabilities(run_id)
      setRunId(run_id)
      setResults(probs)
      getRuns().then(setRuns)
    } finally {
      clearInterval(progRef.current)
      setLoading(false)
      setTimeout(() => setProgress(0), 800)
    }
  }

  const sorted = [...results]
    .filter(r => r.team_name.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => sortDir === 'desc' ? b[sortCol] - a[sortCol] : a[sortCol] - b[sortCol])

  const cols = [
    { key: 'p_qualify',   label: 'Qualify' },
    { key: 'p_first',     label: 'Group 1st' },
    { key: 'p_semifinal', label: 'Semi' },
    { key: 'p_finalist',  label: 'Final' },
    { key: 'p_champion',  label: 'Champion' },
  ]

  const leagueNames = { 39: 'Premier League', 140: 'La Liga', 135: 'Serie A' }

  return (
    <div className="page">
      <div style={{ marginBottom: 28 }}>
        <div className="page-title">Simulation</div>
        <div className="page-sub">Monte Carlo · Elo Model · {leagueNames[leagueId] || 'League'} · 16 teams</div>
      </div>

      {/* Controls */}
      <div className="card" style={{ padding: 24, marginBottom: 20 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 16, alignItems: 'flex-end' }}>
          <div className="control-group">
            <label className="control-label">Iterations</label>
            <select value={n} onChange={e => setN(Number(e.target.value))}>
              <option value={1000}>1,000 — Quick</option>
              <option value={10000}>10,000 — Default</option>
              <option value={50000}>50,000 — Accurate</option>
            </select>
          </div>

          {runs.length > 0 && (
            <div className="control-group">
              <label className="control-label">Previous Run</label>
              <select value={runId ?? ''} onChange={e => {
                const id = Number(e.target.value)
                setRunId(id)
                getProbabilities(id).then(setResults)
              }}>
                {runs.map(r => (
                  <option key={r.id} value={r.id}>
                    Run #{r.id} · {r.n_iterations.toLocaleString()} iters
                  </option>
                ))}
              </select>
            </div>
          )}

          <button className="btn btn-primary" onClick={simulate} disabled={loading} style={{ height: 40 }}>
            {loading
              ? <><span className="spinner-ring" />Simulating…</>
              : <><Icons.Simulate size={15} />Run Simulation</>}
          </button>
        </div>

        {(loading || progress > 0) && (
          <div className="progress-wrap" style={{ marginTop: 20 }}>
            <div className="progress-bar" style={{ width: `${progress}%` }} />
            <span className="progress-label">{Math.round(progress)}%</span>
          </div>
        )}
      </div>

      {/* Results Table */}
      {results.length > 0 && (
        <div className="card animate-in">
          <div className="table-toolbar">
            <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
              <Icons.Search size={14} color="var(--text3)" style={{ position: 'absolute', left: 12 }} />
              <input type="text" placeholder="Search team…" value={search}
                onChange={e => setSearch(e.target.value)}
                style={{ paddingLeft: 36, width: 220 }} />
            </div>
            <div className="run-info">Run #{runId} · {results.length} teams</div>
          </div>
          <table>
            <thead>
              <tr>
                <th style={{ width: 40 }}>#</th>
                <th>Team</th>
                <th onClick={() => handleSort('elo_rating')} className="sortable">
                  Elo {sortCol === 'elo_rating' ? (sortDir === 'desc' ? '↓' : '↑') : ''}
                </th>
                {cols.map(c => (
                  <th key={c.key} onClick={() => handleSort(c.key)} className="sortable">
                    {c.label} {sortCol === c.key ? (sortDir === 'desc' ? '↓' : '↑') : ''}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.map((r, i) => {
                const t    = teams.find(t => t.team_name === r.team_name)
                const logo = t ? teamLogoUrl(t.team_id) : null
                const medal = i === 0 ? <Icons.Trophy size={15} color="var(--amber)" />
                            : i === 1 ? <span style={{ color:'#C0C0C0', fontWeight:700 }}>2</span>
                            : i === 2 ? <span style={{ color:'#CD7F32', fontWeight:700 }}>3</span>
                            : <span style={{ color:'var(--text3)' }}>{i+1}</span>
                return (
                  <tr key={r.team_name} className="animate-in" style={{ animationDelay: `${i * 0.02}s` }}>
                    <td>{medal}</td>
                    <td>
                      <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                        {logo && <img src={logo} alt="" className="team-logo-sm" />}
                        <span style={{ fontWeight:600 }}>{r.team_name}</span>
                      </div>
                    </td>
                    <td style={{ color:'var(--text2)', fontWeight:600 }}>
                      {r.elo_rating ? Number(r.elo_rating).toFixed(0) : '—'}
                    </td>
                    {cols.map(c => (
                      <td key={c.key}><ProbBar val={Number(r[c.key])} /></td>
                    ))}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {results.length === 0 && !loading && (
        <div className="empty-msg">
          <Icons.Simulate size={40} color="var(--text3)" />
          <div>Run a simulation to see championship probabilities</div>
        </div>
      )}
    </div>
  )
}