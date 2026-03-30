import { useState, useEffect } from 'react'
import { getTeams, getRuns, getProbabilities, teamLogoUrl } from '../api'
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
  const [teams, setTeams]     = useState([])
  const [probs, setProbs]     = useState({})
  const [search, setSearch]   = useState('')
  const [compare, setCompare] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setTeams([])
    setProbs({})
    setLoading(true)
    Promise.all([getTeams(leagueId), getRuns()]).then(([td, runs]) => {
      setTeams(td)
      if (runs.length > 0) {
        getProbabilities(runs[0].id).then(data => {
          const pm = {}
          data.forEach(r => { pm[r.team_name] = r })
          setProbs(pm)
          setLoading(false)
        })
      } else {
        setLoading(false)
      }
    }).catch(() => setLoading(false))
  }, [leagueId])

  const toggleCompare = (name) => {
    setCompare(c => c.includes(name) ? c.filter(x => x !== name) : c.length < 2 ? [...c, name] : c)
  }

  const filtered = teams.filter(t => t.team_name.toLowerCase().includes(search.toLowerCase()))

  const compareTeams = compare.map(name => ({
    team: teams.find(t => t.team_name === name),
    prob: probs[name]
  }))

  const leagueNames = { 39: 'Premier League', 140: 'La Liga', 135: 'Serie A' }

  return (
    <div className="page">
      <div className="page-title">Teams</div>
      <div className="page-sub">{leagueNames[leagueId]} · Click 2 teams to compare</div>

      {/* Search */}
      <div style={{ marginBottom: 20, position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
        <Icons.Search size={14} color="var(--text3)" style={{ position: 'absolute', left: 14 }} />
        <input type="text" placeholder="Search team…" value={search}
          onChange={e => setSearch(e.target.value)} style={{ paddingLeft: 38, width: 260 }} />
      </div>

      {/* Compare Panel */}
      {compare.length === 2 && (
        <div className="card card-pad animate-in" style={{ marginBottom: 24 }}>
          <div className="compare-header">
            <span style={{ fontSize: 15 }}>Team Comparison</span>
            <button className="btn btn-ghost" style={{ padding: '5px 12px', fontSize: 12 }}
              onClick={() => setCompare([])}>
              <Icons.X size={12} /> Clear
            </button>
          </div>
          <div className="compare-grid">
            {compareTeams.map(({ team, prob }, i) => team && (
              <div key={i} className="compare-col">
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                  {teamLogoUrl(team.team_id) && (
                    <img src={teamLogoUrl(team.team_id)} alt="" className="team-logo" />
                  )}
                  <div>
                    <div className="compare-name">{team.team_name}</div>
                    <div className="compare-elo">{Number(team.elo_rating).toFixed(0)} Elo · {team.country}</div>
                  </div>
                </div>
                {prob && (
                  <div className="compare-stats">
                    {[
                      ['Qualify',  prob.p_qualify],
                      ['Semi',     prob.p_semifinal],
                      ['Final',    prob.p_finalist],
                      ['Champion', prob.p_champion],
                    ].map(([label, val]) => (
                      <div key={label} className="compare-stat-row">
                        <span className="compare-stat-label">{label}</span>
                        <div className="prob-bar-wrap" style={{ flex: 1 }}>
                          <span style={{ color: val >= 50 ? 'var(--green)' : val >= 15 ? 'var(--amber)' : 'var(--red)', fontWeight: 700, minWidth: 38, fontSize: 13 }}>{val}%</span>
                          <div className="prob-bar-bg">
                            <div className="prob-bar-fill" style={{ width: `${val}%`, background: val >= 50 ? 'var(--green)' : val >= 15 ? 'var(--amber)' : 'var(--red)' }} />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Teams Grid */}
      {loading ? (
        <div className="empty-msg"><span className="spinner-ring" /><span>Loading teams…</span></div>
      ) : filtered.length === 0 ? (
        <div className="empty-msg">
          <Icons.Shield size={40} color="var(--text3)" />
          <div>No teams found. Run the pipeline to import data for this league.</div>
        </div>
      ) : (
        <div className="teams-grid">
          {filtered.map((team, idx) => {
            const p = probs[team.team_name]
            const isSelected = compare.includes(team.team_name)
            const logo = teamLogoUrl(team.team_id)
            return (
              <div
                key={team.team_name}
                className={`team-card animate-in ${isSelected ? 'team-card-selected' : ''}`}
                style={{ animationDelay: `${idx * 0.03}s` }}
                onClick={() => toggleCompare(team.team_name)}
              >
                <div className="team-card-header">
                  <div className="team-card-logo-name">
                    {logo ? (
                      <img src={logo} alt={team.team_name} className="team-logo" />
                    ) : (
                      <div style={{ width: 40, height: 40, background: 'var(--bg4)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Icons.Shield size={20} color="var(--text3)" />
                      </div>
                    )}
                    <div>
                      <div className="team-card-name">{team.team_name}</div>
                      <div className="team-card-country">{team.country} · Est. {team.founded}</div>
                    </div>
                  </div>
                  {isSelected && <span className="badge badge-green"><Icons.Check size={11} /> Selected</span>}
                </div>

                <div className="team-card-elo">
                  <span className="elo-num">{Number(team.elo_rating).toFixed(0)}</span>
                  <span className="elo-label">Elo</span>
                </div>

                {p && (
                  <div className="team-card-probs">
                    <ProbBar label="Qualify" val={p.p_qualify} />
                    <ProbBar label="Semi" val={p.p_semifinal} />
                    <ProbBar label="Champion" val={p.p_champion} />
                  </div>
                )}

                {team.venue_name && (
                  <div className="team-card-venue">
                    {team.venue_name}{team.venue_city ? ` · ${team.venue_city}` : ''}
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