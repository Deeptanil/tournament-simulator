import { useState, useEffect } from 'react'
import { getTeams, teamLogoUrl } from '../api'
import { Icons } from '../Icons'

function ProbBar({ label, val }) {
  const color = val >= 50 ? 'var(--green)' : val >= 15 ? 'var(--amber)' : 'var(--red)'
  return (
    <div className="team-prob-row">
      <span style={{ color: 'var(--text3)', fontSize: 11 }}>{label}</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1, justifyContent: 'flex-end' }}>
        <div style={{ width: 50, height: 4, background: 'var(--bg5)', borderRadius: 2, overflow: 'hidden' }}>
          <div style={{ width: `${Math.min(val, 100)}%`, height: '100%', background: color, borderRadius: 2, transition: 'width 0.5s ease' }} />
        </div>
        <span style={{ color, fontWeight: 700, fontSize: 12, minWidth: 32, textAlign: 'right' }}>{val}%</span>
      </div>
    </div>
  )
}

export default function Teams({ leagueId }) {
  const [teams,   setTeams]   = useState([])
  const [search,  setSearch]  = useState('')
  const [compare, setCompare] = useState([])
  const [loading, setLoading] = useState(true)

  // Reload teams every time the league changes — no cross-league simulation data
  useEffect(() => {
    setTeams([])
    setCompare([])
    setLoading(true)
    getTeams(leagueId)
      .then(data => { setTeams(data); setLoading(false) })
      .catch(() => setLoading(false))
  }, [leagueId])

  const toggleCompare = (name) => {
    setCompare(c => c.includes(name) ? c.filter(x => x !== name) : c.length < 2 ? [...c, name] : c)
  }

  const filtered = teams.filter(t => t.team_name.toLowerCase().includes(search.toLowerCase()))

  const compareTeams = compare.map(name => teams.find(t => t.team_name === name)).filter(Boolean)

  const leagueNames = { 39: 'Premier League', 140: 'La Liga', 135: 'Serie A' }

  return (
    <div className="page">
      <div className="page-title">Teams</div>
      <div className="page-sub">{leagueNames[leagueId]} · {teams.length} teams · Click 2 teams to compare</div>

      {/* Search */}
      <div style={{ marginBottom: 20, position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
        <Icons.Search size={14} color="var(--text3)" style={{ position: 'absolute', left: 14 }} />
        <input type="text" placeholder="Search team…" value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ paddingLeft: 38, width: 260 }} />
      </div>

      {/* Compare Panel */}
      {compare.length === 2 && (
        <div className="card card-pad animate-in" style={{ marginBottom: 24 }}>
          <div className="compare-header">
            <span style={{ fontSize: 15, fontWeight: 700 }}>Head-to-Head Comparison</span>
            <button className="btn btn-ghost" style={{ padding: '5px 12px', fontSize: 12 }}
              onClick={() => setCompare([])}>
              <Icons.X size={12} /> Clear
            </button>
          </div>
          <div className="compare-grid">
            {compareTeams.map((team, i) => {
              const logo = teamLogoUrl(team.team_id)
              return (
                <div key={i} className="compare-col">
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
                        {Number(team.elo_rating).toFixed(0)} Elo
                        {team.country ? ` · ${team.country}` : ''}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <InfoRow label="Stadium"  value={team.venue_name || '—'} />
                    <InfoRow label="City"     value={team.venue_city || '—'} />
                    <InfoRow label="Founded"  value={team.founded || '—'} />
                    <InfoRow label="Elo Rating" value={Number(team.elo_rating).toFixed(0)} highlight />
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
            // Elo color: top 4 = green, 5-12 = amber, bottom 4 = red
            const rank       = filtered.indexOf(team) + 1
            const total      = filtered.length
            const eloColor   = rank <= 4 ? 'var(--green)' : rank <= total - 4 ? 'var(--amber)' : 'var(--red)'

            return (
              <div
                key={team.team_name}
                className={`team-card animate-in ${isSelected ? 'team-card-selected' : ''}`}
                style={{ animationDelay: `${idx * 0.025}s`, cursor: 'pointer' }}
                onClick={() => toggleCompare(team.team_name)}
              >
                {/* Header row */}
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
                        {[team.country, team.founded ? `Est. ${team.founded}` : null].filter(Boolean).join(' · ') || leagueNames[leagueId]}
                      </div>
                    </div>
                  </div>
                  {isSelected && <span className="badge badge-green"><Icons.Check size={11} /> Selected</span>}
                </div>

                {/* Elo rating bar */}
                <div style={{ marginTop: 14 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <span style={{ fontSize: 10, color: 'var(--text3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>Elo Rating</span>
                    <span style={{ fontSize: 16, fontWeight: 900, color: eloColor }}>{elo.toFixed(0)}</span>
                  </div>
                  <div style={{ height: 5, background: 'var(--bg5)', borderRadius: 3, overflow: 'hidden' }}>
                    <div style={{
                      height: '100%', borderRadius: 3,
                      background: eloColor,
                      width: `${Math.max(5, Math.min(100, ((elo - 1480) / (2000 - 1480)) * 100))}%`,
                      transition: 'width 0.6s ease',
                    }} />
                  </div>
                </div>

                {/* Venue */}
                {team.venue_name && (
                  <div className="team-card-venue" style={{ marginTop: 10, fontSize: 11, color: 'var(--text3)' }}>
                    {team.venue_name}{team.venue_city ? ` · ${team.venue_city}` : ''}
                  </div>
                )}

                {/* Compare hint */}
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

function InfoRow({ label, value, highlight }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
      <span style={{ fontSize: 11, color: 'var(--text3)' }}>{label}</span>
      <span style={{ fontSize: 12, fontWeight: highlight ? 700 : 400, color: highlight ? 'var(--green)' : 'var(--text2)' }}>
        {value}
      </span>
    </div>
  )
}