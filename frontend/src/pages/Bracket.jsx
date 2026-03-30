import { useState, useEffect } from 'react'
import { getRuns, getProbabilities, getGroups } from '../api'
import { teamLogoUrl } from '../api'
import { Icons } from '../Icons'

export default function Bracket({ leagueId }) {
  const [probs, setProbs]   = useState([])
  const [runId, setRunId]   = useState(null)
  const [runs, setRuns]     = useState([])
  const [groups, setGroups] = useState({})

  useEffect(() => {
    setProbs([])
    setGroups({})
    getGroups(leagueId).then(setGroups).catch(() => {})
    getRuns().then(data => {
      setRuns(data)
      if (data.length > 0) {
        setRunId(data[0].id)
        getProbabilities(data[0].id).then(setProbs)
      }
    })
  }, [leagueId])

  const byName = (name) => probs.find(p => p.team_name === name)

  // Build bracket from dynamic groups
  const likelyFirst = (g) => {
    const gteams = (groups[g] || []).map(t => t.team_name)
    return gteams.slice().sort((a, b) => (byName(b)?.p_qualify || 0) - (byName(a)?.p_qualify || 0))[0]
  }
  const likelySecond = (g) => {
    const gteams = (groups[g] || []).map(t => t.team_name)
    return gteams.slice().sort((a, b) => (byName(b)?.p_qualify || 0) - (byName(a)?.p_qualify || 0))[1]
  }

  const getTeamId = (name) => {
    for (const gteams of Object.values(groups)) {
      const t = gteams.find(t => t.team_name === name)
      if (t) return t.team_id
    }
    return null
  }

  const TeamBox = ({ name, highlight }) => {
    const p = byName(name)
    const logo = getTeamId(name) ? teamLogoUrl(getTeamId(name)) : null
    return (
      <div className={`bracket-team ${highlight ? 'bracket-team-win' : ''}`}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {logo && <img src={logo} alt="" className="team-logo-sm" />}
          <span className="bracket-team-name">{name || 'TBD'}</span>
        </div>
        {p && <span className="bracket-team-prob">{p.p_champion}%</span>}
      </div>
    )
  }

  const MatchBox = ({ t1, t2 }) => {
    const p1 = byName(t1)?.p_champion || 0
    const p2 = byName(t2)?.p_champion || 0
    const winner = p1 >= p2 ? t1 : t2
    return (
      <div className="bracket-match">
        <TeamBox name={t1} highlight={winner === t1} />
        <TeamBox name={t2} highlight={winner === t2} />
      </div>
    )
  }

  const hasData = probs.length > 0 && Object.keys(groups).length > 0

  if (!hasData) return (
    <div className="page">
      <div className="page-title">Knockout Bracket</div>
      <div className="page-sub">Most likely bracket path based on champion probabilities</div>
      <div className="empty-msg">
        <Icons.Bracket size={40} color="var(--text3)" />
        <div>Run a simulation to see the bracket</div>
      </div>
    </div>
  )

  const qf = [
    [likelyFirst('A'), likelySecond('B')],
    [likelyFirst('C'), likelySecond('D')],
    [likelyFirst('B'), likelySecond('A')],
    [likelyFirst('D'), likelySecond('C')],
  ]

  const sfTeams = qf.map(([a, b]) => {
    const pa = byName(a)?.p_champion || 0
    const pb = byName(b)?.p_champion || 0
    return pa >= pb ? a : b
  })

  const f1 = (byName(sfTeams[0])?.p_champion || 0) >= (byName(sfTeams[1])?.p_champion || 0) ? sfTeams[0] : sfTeams[1]
  const f2 = (byName(sfTeams[2])?.p_champion || 0) >= (byName(sfTeams[3])?.p_champion || 0) ? sfTeams[2] : sfTeams[3]
  const finalWinner = (byName(f1)?.p_champion || 0) >= (byName(f2)?.p_champion || 0) ? f1 : f2

  const leagueNames = { 39: 'Premier League', 140: 'La Liga', 135: 'Serie A' }

  return (
    <div className="page">
      <div className="page-title">Knockout Bracket</div>
      <div className="page-sub">{leagueNames[leagueId]} · Most likely bracket path based on simulation probabilities</div>

      {runs.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <div className="control-group" style={{ display: 'inline-flex' }}>
            <label className="control-label">Simulation Run</label>
            <select value={runId ?? ''} onChange={e => {
              const id = Number(e.target.value)
              setRunId(id)
              getProbabilities(id).then(setProbs)
            }}>
              {runs.map(r => (
                <option key={r.id} value={r.id}>Run #{r.id} · {r.n_iterations.toLocaleString()} iterations</option>
              ))}
            </select>
          </div>
        </div>
      )}

      <div className="bracket-wrap" style={{ overflowX: 'auto', paddingBottom: 20 }}>
        {/* Quarter-finals */}
        <div className="bracket-round">
          <div className="bracket-round-label">Quarter-finals</div>
          {qf.map(([a, b], i) => (
            <MatchBox key={i} t1={a} t2={b} />
          ))}
        </div>

        {/* Semi-finals */}
        <div className="bracket-round">
          <div className="bracket-round-label">Semi-finals</div>
          <MatchBox t1={sfTeams[0]} t2={sfTeams[1]} />
          <MatchBox t1={sfTeams[2]} t2={sfTeams[3]} />
        </div>

        {/* Final */}
        <div className="bracket-round">
          <div className="bracket-round-label">Final</div>
          <MatchBox t1={f1} t2={f2} />
        </div>

        {/* Champion */}
        <div className="bracket-round" style={{ minWidth: 180 }}>
          <div className="bracket-round-label">Champion</div>
          <div className="bracket-champion animate-scale">
            <div className="champ-trophy">
              <Icons.Trophy size={48} color="var(--amber)" />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center', marginBottom: 8 }}>
              {getTeamId(finalWinner) && (
                <img src={teamLogoUrl(getTeamId(finalWinner))} alt="" className="team-logo-sm" />
              )}
              <div className="champ-name">{finalWinner}</div>
            </div>
            <div className="champ-prob">{byName(finalWinner)?.p_champion}% chance</div>
          </div>
        </div>
      </div>
    </div>
  )
}