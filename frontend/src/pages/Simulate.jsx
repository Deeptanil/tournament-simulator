import { useState } from 'react'
import { getTeams, teamLogoUrl } from '../api'
import { useEffect } from 'react'
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

export default function Simulate({ leagueId, simResults, simLoading, onReSimulate }) {
  const [sortCol, setSortCol] = useState('p_champion')
  const [sortDir, setSortDir] = useState('desc')
  const [search,  setSearch]  = useState('')
  const [teams,   setTeams]   = useState([])

  useEffect(() => {
    setTeams([])
    getTeams(leagueId).then(setTeams)
  }, [leagueId])

  const handleSort = (col) => {
    if (sortCol === col) setSortDir(d => d === 'desc' ? 'asc' : 'desc')
    else { setSortCol(col); setSortDir('desc') }
  }

  const sorted = [...(simResults || [])]
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
      <div style={{ marginBottom: 28, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div className="page-title">Simulation</div>
          <div className="page-sub">Monte Carlo · Elo Model · {leagueNames[leagueId] || 'League'} · 16 teams</div>
        </div>
        <button className="btn btn-primary" onClick={onReSimulate} disabled={simLoading}>
          {simLoading
            ? <><span className="spinner-ring" />Simulating…</>
            : <><Icons.Simulate size={15} />Re-run Simulation</>}
        </button>
      </div>

      {simLoading && (
        <div className="card card-pad" style={{ marginBottom: 20, display: 'flex', alignItems: 'center', gap: 12 }}>
          <span className="spinner-ring" />
          <span style={{ color: 'var(--text2)' }}>Running 10,000 Monte Carlo iterations for {leagueNames[leagueId]}…</span>
        </div>
      )}

      {sorted.length > 0 && (
        <div className="card animate-in">
          <div className="table-toolbar">
            <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
              <Icons.Search size={14} color="var(--text3)" style={{ position: 'absolute', left: 12 }} />
              <input type="text" placeholder="Search team…" value={search}
                onChange={e => setSearch(e.target.value)}
                style={{ paddingLeft: 36, width: 220 }} />
            </div>
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

      {sorted.length === 0 && !simLoading && (
        <div className="empty-msg">
          <Icons.Simulate size={40} color="var(--text3)" />
          <div>Simulation results will appear here</div>
        </div>
      )}
    </div>
  )
}