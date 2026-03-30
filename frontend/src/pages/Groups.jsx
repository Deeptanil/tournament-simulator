import { useState, useEffect } from 'react'
import { getGroups } from '../api'
import { teamLogoUrl } from '../api'
import { Icons } from '../Icons'

const GROUP_COLORS = { A: '#4fc3f7', B: '#ffa726', C: '#00e676', D: '#a855f7' }

export default function Groups({ leagueId, simResults }) {
  const [groups, setGroups]   = useState({})
  const [loaded, setLoaded]   = useState(false)

  useEffect(() => {
    setLoaded(false)
    setGroups({})
    getGroups(leagueId)
      .then(grpData => { setGroups(grpData); setLoaded(true) })
      .catch(() => setLoaded(true))
  }, [leagueId])

  // Build probs map from parent simResults
  const probs = {}
  ;(simResults || []).forEach(r => { probs[r.team_name] = r })

  const leagueNames = { 39: 'Premier League', 140: 'La Liga', 135: 'Serie A', 78: 'Bundesliga', 61: 'Ligue 1' }

  return (
    <div className="page">
      <div className="page-title">Group Stage</div>
      <div className="page-sub">{leagueNames[leagueId]} · 16 teams · 4 groups · Top 2 advance</div>

      {!loaded ? (
        <div className="empty-msg">
          <span className="spinner-ring" />
          <span>Loading groups…</span>
        </div>
      ) : Object.keys(groups).length === 0 ? (
        <div className="empty-msg">
          <Icons.Grid size={40} color="var(--text3)" />
          <div>No teams found for this league. Run the pipeline to populate data.</div>
        </div>
      ) : (
        <div className="groups-grid">
          {Object.entries(groups).map(([gname, gteams]) => (
            <div key={gname} className="card">
              <div className="group-header" style={{ borderColor: GROUP_COLORS[gname] }}>
                <span className="group-letter" style={{ color: GROUP_COLORS[gname] }}>Group {gname}</span>
                <span className="group-sub">4 teams · 6 matches</span>
              </div>
              <table>
                <thead>
                  <tr>
                    <th colSpan={2}>Team</th>
                    <th>Elo</th>
                    {Object.keys(probs).length > 0 && <th>P(Advance)</th>}
                  </tr>
                </thead>
                <tbody>
                  {gteams.map((team, i) => {
                    const p = probs[team.team_name]
                    const logo = teamLogoUrl(team.team_id)
                    const isQualify = i < 2
                    return (
                      <tr key={team.team_name} className={isQualify ? 'qualify-row' : ''}>
                        <td style={{ width: 32, paddingRight: 0 }}>
                          {isQualify && (
                            <span className="qualify-dot" style={{ background: GROUP_COLORS[gname], display: 'inline-block' }} />
                          )}
                        </td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            {logo && <img src={logo} alt="" className="team-logo-sm" />}
                            <span style={{ fontWeight: isQualify ? 600 : 400 }}>{team.team_name}</span>
                          </div>
                        </td>
                        <td style={{ color: 'var(--text2)', fontWeight: 600 }}>
                          {team.elo_rating > 0 ? team.elo_rating.toFixed(0) : '—'}
                        </td>
                        {Object.keys(probs).length > 0 && (
                          <td>
                            {p ? (
                              <span style={{
                                color: p.p_qualify >= 60 ? 'var(--green)' : p.p_qualify >= 35 ? 'var(--amber)' : 'var(--red)',
                                fontWeight: 700, fontSize: 13
                              }}>{p.p_qualify}%</span>
                            ) : '—'}
                          </td>
                        )}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}

      {loaded && Object.keys(probs).length === 0 && Object.keys(groups).length > 0 && (
        <div style={{ marginTop: 16, fontSize: 12, color: 'var(--text3)', textAlign: 'center' }}>
          Run a simulation to see qualification probabilities
        </div>
      )}
    </div>
  )
}