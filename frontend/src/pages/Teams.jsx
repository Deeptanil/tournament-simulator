import { useState, useEffect } from 'react'
import { getTeams, teamLogoUrl, getTeamStats } from '../api'
import { Icons } from '../Icons'

const LEAGUE_NAMES = {
  39: 'Premier League',
  140: 'La Liga',
  135: 'Serie A',
  78: 'Bundesliga',
  61: 'Ligue 1'
}

function InfoRow({ label, value, highlight, sub }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <span style={{ fontSize: 11, color: 'var(--text3)' }}>{label}</span>
        {sub && <span style={{ fontSize: 9, color: 'var(--text3)', opacity: 0.7 }}>{sub}</span>}
      </div>
      <span style={{ fontSize: 12, fontWeight: highlight ? 700 : 400, color: highlight ? 'var(--green)' : 'var(--text2)' }}>
        {value}
      </span>
    </div>
  )
}

export default function Teams({ leagueId }) {
  const [teams,   setTeams]   = useState([])
  const [search,  setSearch]  = useState('')
  const [compare, setCompare] = useState([])
  const [compareStats, setCompareStats] = useState({})
  const [loading, setLoading] = useState(true)

  // Reload teams every time the league changes
  useEffect(() => {
    setTeams([])
    setCompare([])
    setCompareStats({})
    setLoading(true)
    getTeams(leagueId)
      .then(data => { setTeams(data); setLoading(false) })
      .catch(() => setLoading(false))
  }, [leagueId])

  // Fetch stats when compare list changes
  useEffect(() => {
    if (compare.length === 0) {
      setCompareStats({})
      return
    }
    compare.forEach(name => {
      if (!compareStats[name]) {
        getTeamStats(name, leagueId).then(stats => {
          setCompareStats(prev => ({ ...prev, [name]: stats }))
        }).catch(() => {})
      }
    })
  }, [compare, leagueId])

  const toggleCompare = (name) => {
    setCompare(c => c.includes(name) ? c.filter(x => x !== name) : c.length < 2 ? [...c, name] : c)
  }

  const filtered = teams.filter(t => t.team_name.toLowerCase().includes(search.toLowerCase()))
  const compareTeams = compare.map(name => ({
    ...teams.find(t => t.team_name === name),
    stats: compareStats[name]
  })).filter(t => t.team_name)

  return (
    <div className="page">
      <div className="page-title">Teams</div>
      <div className="page-sub">{LEAGUE_NAMES[leagueId]} · {teams.length} teams · Click 2 teams to compare</div>

      {/* Search */}
      <div style={{ marginBottom: 20, position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
        <Icons.Search size={14} color="var(--text3)" style={{ position: 'absolute', left: 14 }} />
        <input type="text" placeholder="Search team…" value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ paddingLeft: 38, width: 260 }} />
      </div>

      {/* Compare Panel */}
      {compare.length > 0 && (
        <div className="card card-pad animate-in" style={{ marginBottom: 24 }}>
          <div className="compare-header">
            <span style={{ fontSize: 15, fontWeight: 700 }}>Comparison {compare.length === 2 ? 'Head-to-Head' : ''}</span>
            <button className="btn btn-ghost" style={{ padding: '5px 12px', fontSize: 12 }}
              onClick={() => { setCompare([]); setCompareStats({}) }}>
              <Icons.X size={12} /> Clear
            </button>
          </div>
          <div className="compare-grid" style={{ gridTemplateColumns: compare.length === 1 ? '1fr' : '1fr 1fr' }}>
            {compareTeams.map((team, i) => {
              const logo = teamLogoUrl(team.team_id)
              const s    = team.stats
              return (
                <div key={i} className="compare-col" style={{ borderLeft: i > 0 ? '1px solid var(--border)' : 'none', paddingLeft: i > 0 ? 24 : 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                    {logo ? (
                      <img src={logo} alt="" className="team-logo" />
                    ) : (
                      <div style={{ width: 48, height: 48, background: 'var(--bg4)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Icons.Shield size={24} color="var(--text3)" />
                      </div>
                    )}
                    <div>
                      <div className="compare-name">{team.team_name}</div>
                      <div className="compare-elo" style={{ marginTop: 2 }}>
                        {Number(team.elo_rating).toFixed(0)} Elo · {team.country || LEAGUE_NAMES[leagueId]}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', marginBottom: 2 }}>Metadata</div>
                      <InfoRow label="Stadium"  value={team.venue_name || '—'} />
                      <InfoRow label="City"     value={team.venue_city || '—'} />
                      <InfoRow label="Founded"  value={team.founded || '—'} />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', marginBottom: 2 }}>All-Time Record</div>
                      {s ? (
                        <>
                          <InfoRow label="Played"   value={s.played} />
                          <InfoRow label="Won"      value={s.wins} highlight />
                          <InfoRow label="Drawn"    value={s.draws} />
                          <InfoRow label="Lost"     value={s.losses} />
                          <InfoRow label="Goals"    value={`${s.gf}:${s.ga}`} sub={`GD: ${s.gd >= 0 ? '+' : ''}${s.gd}`} />
                          <InfoRow label="Win %"    value={`${s.win_pct}%`} highlight />
                        </>
                      ) : (
                        <div style={{ fontSize: 11, color: 'var(--text3)', fontStyle: 'italic' }}>Loading stats…</div>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Teams Grid */}
      {loading ? (
        <div className="empty-msg"><span className="spinner-ring" /><span>Loading teams…</span></div>
      ) : filtered.length === 0 ? (
        <div className="empty-msg">
          <Icons.Shield size={40} color="var(--text3)" />
          <div>No teams found.</div>
        </div>
      ) : (
        <div className="teams-grid">
          {filtered.map((team, idx) => {
            const isSelected = compare.includes(team.team_name)
            const logo       = teamLogoUrl(team.team_id)
            const elo        = Number(team.elo_rating)
            // Range handle: historical data might have Elos from 1300 to 2000
            const rank       = idx + 1
            const total      = filtered.length
            const eloColor   = rank <= 4 ? 'var(--green)' : rank <= total - 4 ? 'var(--amber)' : 'var(--red)'

            return (
              <div
                key={team.team_name}
                className={`team-card animate-in ${isSelected ? 'team-card-selected' : ''}`}
                style={{ animationDelay: `${idx * 0.015}s`, cursor: 'pointer' }}
                onClick={() => toggleCompare(team.team_name)}
              >
                <div className="team-card-header">
                  <div className="team-card-logo-name">
                    {logo ? (
                      <img src={logo} alt={team.team_name} className="team-logo" />
                    ) : (
                      <div style={{ width: 44, height: 44, background: 'var(--bg4)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Icons.Shield size={22} color="var(--text3)" />
                      </div>
                    )}
                    <div>
                      <div className="team-card-name">{team.team_name}</div>
                      <div className="team-card-country" style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>
                        {[team.country, team.founded ? `Est. ${team.founded}` : null].filter(Boolean).join(' · ') || LEAGUE_NAMES[leagueId]}
                      </div>
                    </div>
                  </div>
                  {isSelected && <span className="badge badge-green"><Icons.Check size={11} /> Selected</span>}
                </div>

                <div style={{ marginTop: 14 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <span style={{ fontSize: 10, color: 'var(--text3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>Elo Rating</span>
                    <span style={{ fontSize: 16, fontWeight: 900, color: eloColor }}>{elo.toFixed(0)}</span>
                  </div>
                  <div style={{ height: 5, background: 'var(--bg5)', borderRadius: 3, overflow: 'hidden' }}>
                    <div style={{
                      height: '100%', borderRadius: 3,
                      background: eloColor,
                      // Scale between 1300 and 2000
                      width: `${Math.max(2, Math.min(100, ((elo - 1300) / (2000 - 1300)) * 100))}%`,
                      transition: 'width 0.6s ease',
                    }} />
                  </div>
                </div>

                {team.venue_name && (
                  <div className="team-card-venue" style={{ marginTop: 10, fontSize: 11, color: 'var(--text3)' }}>
                    {team.venue_name}{team.venue_city ? ` · ${team.venue_city}` : ''}
                  </div>
                )}
                {!isSelected && compare.length < 2 && (
                  <div style={{ marginTop: 10, fontSize: 10, color: 'var(--text3)', textAlign: 'center' }}>
                    Click to compare
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}