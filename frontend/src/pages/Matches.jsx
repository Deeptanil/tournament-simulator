import { useState, useEffect } from 'react'
import { getTeams, getMatches, teamLogoUrl } from '../api'
import { Icons } from '../Icons'

const outcomeColor = (o) =>
  o === 'Home Win' ? 'var(--blue)' : o === 'Away Win' ? 'var(--amber)' : 'var(--text3)'

export default function Matches({ leagueId }) {
  const [matches, setMatches]   = useState([])
  const [teams, setTeams]       = useState([])
  const [filters, setFilters]   = useState({ team: '', season: '', outcome: '' })
  const [loading, setLoading]   = useState(false)
  const [expanded, setExpanded] = useState(null)  // index of expanded match

  useEffect(() => {
    getTeams(leagueId).then(setTeams)
  }, [leagueId])

  useEffect(() => {
    setLoading(true)
    setExpanded(null)
    const params = {}
    if (filters.team)    params.team    = filters.team
    if (filters.season)  params.season  = filters.season
    if (filters.outcome) params.outcome = filters.outcome
    getMatches(params)
      .then(data => { setMatches(data); setLoading(false) })
      .catch(() => setLoading(false))
  }, [filters])

  const teamData = (name) => teams.find(t => t.team_name === name)
  const logo     = (name) => teamLogoUrl(teamData(name)?.team_id)

  const leagueNames = { 39: 'Premier League', 140: 'La Liga', 135: 'Serie A' }

  return (
    <div className="page">
      <div className="page-title">Historical Matches</div>
      <div className="page-sub">{leagueNames[leagueId]} · {matches.length} matches · Click a row to see details</div>

      {/* Filters */}
      <div className="card card-pad" style={{ marginBottom: 20 }}>
        <div className="filter-row">
          <div className="control-group">
            <label className="control-label">Team</label>
            <select value={filters.team} onChange={e => setFilters(f => ({ ...f, team: e.target.value }))}>
              <option value="">All teams</option>
              {teams.map(t => <option key={t.team_name} value={t.team_name}>{t.team_name}</option>)}
            </select>
          </div>
          <div className="control-group">
            <label className="control-label">Season</label>
            <select value={filters.season} onChange={e => setFilters(f => ({ ...f, season: e.target.value }))}>
              <option value="">All seasons</option>
              <option value="2022">2022–23</option>
              <option value="2023">2023–24</option>
            </select>
          </div>
          <div className="control-group">
            <label className="control-label">Result</label>
            <select value={filters.outcome} onChange={e => setFilters(f => ({ ...f, outcome: e.target.value }))}>
              <option value="">All results</option>
              <option value="Home Win">Home Win</option>
              <option value="Away Win">Away Win</option>
              <option value="Draw">Draw</option>
            </select>
          </div>
          <button className="btn btn-ghost" onClick={() => setFilters({ team: '', season: '', outcome: '' })}>
            <Icons.Refresh size={13} /> Reset
          </button>
        </div>
      </div>

      {/* Match List */}
      <div className="card" style={{ overflow: 'hidden' }}>
        {loading ? (
          <div className="empty-msg"><span className="spinner-ring" /><span>Loading…</span></div>
        ) : matches.length === 0 ? (
          <div className="empty-msg">
            <Icons.Calendar size={40} color="var(--text3)" />
            <div>No matches found</div>
          </div>
        ) : (
          matches.map((m, i) => {
            const homeWin = m.outcome === 'Home Win'
            const awayWin = m.outcome === 'Away Win'
            const isDraw  = m.outcome === 'Draw'
            const isOpen  = expanded === i
            const oColor  = outcomeColor(m.outcome)
            const homeLogo = logo(m.home_team)
            const awayLogo = logo(m.away_team)

            return (
              <div key={i}>
                {/* Row */}
                <div
                  onClick={() => setExpanded(isOpen ? null : i)}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '100px 1fr 88px 1fr 80px 28px',
                    gap: 0, paddingBlock: 14, paddingInline: 20,
                    borderBottom: isOpen ? '1px solid var(--border2)' : '1px solid var(--border)',
                    alignItems: 'center',
                    cursor: 'pointer',
                    background: isOpen ? 'rgba(255,255,255,0.03)' : 'transparent',
                    transition: 'background 0.15s',
                  }}
                  onMouseEnter={e => !isOpen && (e.currentTarget.style.background = 'rgba(255,255,255,0.025)')}
                  onMouseLeave={e => !isOpen && (e.currentTarget.style.background = 'transparent')}
                >
                  <span style={{ fontSize: 11, color: 'var(--text3)' }}>
                    {new Date(m.match_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' })}
                  </span>

                  {/* Home team */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'flex-end' }}>
                    <span style={{
                      fontWeight: homeWin ? 700 : 400,
                      color: homeWin ? 'var(--green)' : awayWin ? 'var(--text3)' : 'var(--text2)',
                      fontSize: 13, textAlign: 'right',
                      textDecoration: awayWin ? 'line-through' : 'none',
                      opacity: awayWin ? 0.5 : 1,
                    }}>
                      {m.home_team}
                    </span>
                    {homeLogo && <img src={homeLogo} alt="" style={{ width: 22, height: 22, objectFit: 'contain', flexShrink: 0 }} />}
                  </div>

                  {/* Score */}
                  <div style={{
                    textAlign: 'center', fontSize: 17, fontWeight: 900,
                    letterSpacing: 2, paddingInline: 10,
                    color: isDraw ? 'var(--text3)' : 'var(--text)',
                  }}>
                    <span style={{ color: homeWin ? 'var(--green)' : 'inherit' }}>{m.home_goals}</span>
                    <span style={{ color: 'var(--text3)', marginInline: 4 }}>–</span>
                    <span style={{ color: awayWin ? 'var(--green)' : 'inherit' }}>{m.away_goals}</span>
                  </div>

                  {/* Away team */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {awayLogo && <img src={awayLogo} alt="" style={{ width: 22, height: 22, objectFit: 'contain', flexShrink: 0 }} />}
                    <span style={{
                      fontWeight: awayWin ? 700 : 400,
                      color: awayWin ? 'var(--green)' : homeWin ? 'var(--text3)' : 'var(--text2)',
                      fontSize: 13,
                      textDecoration: homeWin ? 'line-through' : 'none',
                      opacity: homeWin ? 0.5 : 1,
                    }}>
                      {m.away_team}
                    </span>
                  </div>

                  {/* Result badge */}
                  <div style={{ textAlign: 'right' }}>
                    <span style={{
                      fontSize: 10, fontWeight: 700, color: oColor,
                      background: `${oColor}15`, padding: '3px 8px',
                      borderRadius: 20, border: `1px solid ${oColor}30`,
                      display: 'inline-block',
                    }}>
                      {isDraw ? 'Draw' : homeWin ? 'H' : 'A'}
                    </span>
                  </div>

                  {/* Expand arrow */}
                  <div style={{ color: 'var(--text3)', display: 'flex', justifyContent: 'flex-end', transition: 'transform 0.2s', transform: isOpen ? 'rotate(180deg)' : 'none' }}>
                    <Icons.ChevronDown size={14} />
                  </div>
                </div>

                {/* Expanded detail */}
                {isOpen && (
                  <div className="animate-in" style={{
                    padding: '20px 24px', borderBottom: '1px solid var(--border)',
                    background: 'rgba(255,255,255,0.02)',
                    display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 20,
                  }}>
                    {/* Home */}
                    <div style={{ textAlign: 'center' }}>
                      {homeLogo && <img src={homeLogo} alt="" style={{ width: 40, height: 40, objectFit: 'contain', marginBottom: 8 }} />}
                      <div style={{ fontWeight: 700, color: homeWin ? 'var(--green)' : 'var(--text2)', fontSize: 14 }}>{m.home_team}</div>
                      <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>Home side</div>
                      {homeWin && <div style={{ margin: '8px auto', fontWeight: 700, fontSize: 11, color: 'var(--green)' }}>Winner</div>}
                    </div>

                    {/* Center stats */}
                    <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 8, justifyContent: 'center' }}>
                      <div style={{ fontSize: 36, fontWeight: 900, letterSpacing: 4 }}>
                        <span style={{ color: homeWin ? 'var(--green)' : 'var(--text)' }}>{m.home_goals}</span>
                        <span style={{ color: 'var(--text3)', marginInline: 8 }}>–</span>
                        <span style={{ color: awayWin ? 'var(--green)' : 'var(--text)' }}>{m.away_goals}</span>
                      </div>
                      <span style={{ color: oColor, fontWeight: 700, fontSize: 12 }}>{m.outcome}</span>
                      <span style={{ color: 'var(--text3)', fontSize: 11 }}>Season {m.season}/{Number(m.season) + 1}</span>
                    </div>

                    {/* Away */}
                    <div style={{ textAlign: 'center' }}>
                      {awayLogo && <img src={awayLogo} alt="" style={{ width: 40, height: 40, objectFit: 'contain', marginBottom: 8 }} />}
                      <div style={{ fontWeight: 700, color: awayWin ? 'var(--green)' : 'var(--text2)', fontSize: 14 }}>{m.away_team}</div>
                      <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>Away side</div>
                      {awayWin && <div style={{ margin: '8px auto', fontWeight: 700, fontSize: 11, color: 'var(--green)' }}>Winner</div>}
                    </div>
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}