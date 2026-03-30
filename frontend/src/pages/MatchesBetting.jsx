import { useState, useEffect, useCallback, useRef } from 'react'
import { getTeams, simulateMatch, teamLogoUrl, getHighScores, postHighScore } from '../api'
import { Icons } from '../Icons'

/* ── Helpers ───────────────────────────────────────────────────────────────── */
const MAX_SCORE  = 9
const HISTORY_SZ = 6
const recentPairs = []   // rolling list of {home, away} to avoid repetition

const markPair = (h, a) => {
  recentPairs.push(`${h}|${a}`)
  if (recentPairs.length > HISTORY_SZ) recentPairs.shift()
}
const pairSeen = (h, a) => recentPairs.includes(`${h}|${a}`) || recentPairs.includes(`${a}|${h}`)

function pickPair(teams, exclude) {
  // pick home != away != exclude, not recently shown
  const pool = teams.filter(t => t.team_name !== exclude)
  if (pool.length < 2) return [teams[0], teams[1]]
  for (let i = 0; i < 20; i++) {
    const h = pool[Math.floor(Math.random() * pool.length)]
    const a = pool.filter(t => t.team_name !== h.team_name)[Math.floor(Math.random() * (pool.length - 1))]
    if (!pairSeen(h.team_name, a.team_name)) return [h, a]
  }
  // fallback: just return two different teams
  const h = pool[0]
  const a = pool.find(t => t.team_name !== h.team_name)
  return [h, a]
}

/* ── Score +/- stepper ─────────────────────────────────────────────────────── */
function Stepper({ value, onChange, color }) {
  const btnStyle = (active) => ({
    width: 40, height: 40, border: 'none', borderRadius: 10,
    background: active ? `${color}20` : 'var(--bg4)',
    color: active ? color : 'var(--text3)',
    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
    transition: 'all 0.15s', fontFamily: 'Inter,sans-serif',
  })
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <button style={btnStyle(value > 0)} onClick={() => onChange(Math.max(0, value - 1))}>
        <Icons.Minus size={16} />
      </button>
      <div style={{
        width: 60, textAlign: 'center', fontSize: 36, fontWeight: 900, color,
        background: 'var(--bg3)', borderRadius: 12, padding: '6px 0',
        border: `2px solid ${color}40`,
      }}>{value}</div>
      <button style={btnStyle(value < MAX_SCORE)} onClick={() => onChange(Math.min(MAX_SCORE, value + 1))}>
        <Icons.Plus size={16} />
      </button>
    </div>
  )
}

/* ── Team side card ─────────────────────────────────────────────────────────── */
function TeamCard({ team, score, onScore, color, label, revealed, eloRating, disabled }) {
  const logo = teamLogoUrl(team?.team_id)
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      gap: 16, padding: '32px 24px', flex: 1,
      position: 'relative', overflow: 'hidden',
    }}>
      {/* Faded team logo as bg */}
      {logo && (
        <div style={{
          position: 'absolute', inset: 0, zIndex: 0,
          backgroundImage: `url(${logo})`,
          backgroundSize: '60%', backgroundRepeat: 'no-repeat',
          backgroundPosition: 'center', opacity: 0.04,
          filter: 'grayscale(1)',
        }} />
      )}
      <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
        <div style={{ fontSize: 10, fontWeight: 700, color, textTransform: 'uppercase', letterSpacing: 1.5 }}>{label}</div>

        {/* Logo */}
        <div style={{
          width: 80, height: 80, borderRadius: '50%',
          background: `${color}10`, border: `2px solid ${color}30`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: `0 0 30px ${color}15`,
        }}>
          {logo
            ? <img src={logo} alt={team?.team_name} style={{ width: 60, height: 60, objectFit: 'contain' }} />
            : <Icons.Shield size={36} color={color} />
          }
        </div>

        <div style={{ fontSize: 18, fontWeight: 800, textAlign: 'center', color: 'var(--text)' }}>
          {team?.team_name || '—'}
        </div>

        {/* Elo — only shown after reveal */}
        <div style={{
          height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'opacity 0.4s',
          opacity: revealed && eloRating ? 1 : 0,
        }}>
          <span style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 600 }}>
            Elo: {eloRating}
          </span>
        </div>

        {/* Score stepper */}
        <Stepper value={score} onChange={onScore} color={disabled ? 'var(--text3)' : color} />
      </div>
    </div>
  )
}

/* ── High Score Panel ─────────────────────────────────────────────────────── */
function HighScorePanel({ show, onClose, scores, current }) {
  if (!show) return null
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(8,11,20,0.85)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={onClose}>
      <div style={{ background: 'var(--bg2)', border: '1px solid var(--border2)', borderRadius: 24, padding: '36px 40px', minWidth: 360, maxWidth: 440, boxShadow: '0 40px 80px rgba(0,0,0,0.6)' }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
          <Icons.Trophy size={28} color="var(--amber)" />
          <div>
            <div style={{ fontWeight: 800, fontSize: 18 }}>Leaderboard</div>
            <div style={{ fontSize: 12, color: 'var(--text3)' }}>Match Bet — Best Streaks</div>
          </div>
        </div>
        {scores.length === 0 && <div style={{ color: 'var(--text3)', textAlign: 'center', padding: 20 }}>No scores yet!</div>}
        {scores.map((s, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', borderRadius: 10, marginBottom: 6, background: i === 0 ? 'rgba(255,180,0,0.1)' : 'var(--bg3)', border: `1px solid ${i === 0 ? 'rgba(255,180,0,0.25)' : 'var(--border)'}` }}>
            <span style={{ fontWeight: 800, color: i === 0 ? 'var(--amber)' : 'var(--text3)', minWidth: 24 }}>{i === 0 ? '🏆' : `#${i+1}`}</span>
            <span style={{ fontWeight: 800, fontSize: 18, color: i === 0 ? 'var(--amber)' : 'var(--text)' }}>{s.score}</span>
          </div>
        ))}
        {current > 0 && <div style={{ marginTop: 16, padding: '12px 14px', borderRadius: 10, background: 'rgba(0,230,118,0.08)', border: '1px solid rgba(0,230,118,0.2)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><span style={{ color: 'var(--green)', fontWeight: 700 }}>Your Best</span><span style={{ color: 'var(--green)', fontWeight: 800, fontSize: 18 }}>{current}</span></div>}
        <button onClick={onClose} className="btn btn-primary" style={{ width: '100%', marginTop: 20 }}>Close</button>
      </div>
    </div>
  )
}

/* ── Main component ──────────────────────────────────────────────────────────── */
export default function MatchesBetting({ leagueId, points, setPoints }) {
  const [teams,      setTeams]      = useState([])
  const [home,       setHome]       = useState(null)
  const [away,       setAway]       = useState(null)
  const [guessH,     setGuessH]     = useState(1)
  const [guessA,     setGuessA]     = useState(1)
  const [phase,      setPhase]      = useState('loading')  // loading|playing|reveal
  const [result,     setResult]     = useState(null)
  const [history,    setHistory]    = useState([])
  const [streak,     setStreak]     = useState(0)
  const [bestStreak, setBestStreak] = useState(() => parseInt(localStorage.getItem('mb_best') || '0'))
  const [showLD,     setShowLD]     = useState(false)
  const [hsScores,   setHsScores]   = useState([])
  const simulating = useRef(false)

  const loadScores = useCallback(() => {
    getHighScores('match_bet').then(setHsScores).catch(() => {})
  }, [])

  useEffect(() => { loadScores() }, [])

  const updateBest = useCallback((s) => {
    if (s > bestStreak) {
      setBestStreak(s)
      localStorage.setItem('mb_best', s)
      postHighScore('match_bet', s).then(loadScores)
    }
  }, [bestStreak, loadScores])


  // Load teams and pick initial pair
  const loadTeams = useCallback((id) => {
    setPhase('loading')
    getTeams(id).then(data => {
      setTeams(data)
      if (data.length >= 2) {
        const [h, a] = pickPair(data, null)
        setHome(h); setAway(a)
        markPair(h.team_name, a.team_name)
      }
      setPhase('playing')
    })
  }, [])

  useEffect(() => { loadTeams(leagueId) }, [leagueId])

  const lockIn = async () => {
    if (simulating.current || phase !== 'playing' || !home || !away) return
    simulating.current = true
    setPhase('loading')

    try {
      const data = await simulateMatch(home.team_name, away.team_name, leagueId)

      const actualH  = data.home_goals
      const actualA  = data.away_goals
      const userWin  = guessH > guessA ? 'home' : (guessA > guessH ? 'away' : 'draw')
      const realWin  = actualH > actualA ? 'home' : (actualA > actualH ? 'away' : 'draw')
      const exact    = guessH === actualH && guessA === actualA
      const correct  = exact || userWin === realWin

      let gain = 0
      let tag  = ''
      if (exact) {
        gain = 300; tag = 'EXACT SCORE! Triple Points!'
      } else if (correct) {
        gain = 100; tag = 'Correct Outcome!'
      } else {
        gain = -50; tag = 'Wrong Prediction'
      }

      const newStreak = correct ? streak + 1 : 0
      setStreak(newStreak)
      if (!correct) updateBest(streak)
      else updateBest(newStreak)
      setPoints(Math.max(0, points + gain))
      setResult({ ...data, tag, gain, exact, correct, guessH, guessA, homeElo: data.home_elo, awayElo: data.away_elo })
      setPhase('reveal')

      setHistory(h => [{
        home: home.team_name, away: away.team_name,
        score: `${actualH}–${actualA}`, guess: `${guessH}–${guessA}`,
        gain, exact
      }, ...h.slice(0, 4)])
    } finally {
      simulating.current = false
    }
  }

  const nextMatch = () => {
    // Away team becomes Home team for next round
    const newHome = away
    const [, newAway] = pickPair(teams, newHome.team_name)
    setHome(newHome)
    setAway(newAway)
    markPair(newHome.team_name, newAway.team_name)
    setGuessH(1)
    setGuessA(1)
    setResult(null)
    setPhase('playing')
  }

  const leagueNames = { 39: 'Premier League', 140: 'La Liga', 135: 'Serie A', 78: 'Bundesliga', 61: 'Ligue 1' }
  const revealed = phase === 'reveal'
  const playing  = phase === 'playing'

  if (phase === 'loading' && !home) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', gap: 16, flexDirection: 'column' }}>
      <span className="spinner-ring" style={{ width: 40, height: 40, borderWidth: 3 }} />
      <div style={{ color: 'var(--text2)' }}>Loading teams…</div>
    </div>
  )

  return (
    <>
      <HighScorePanel show={showLD} onClose={() => setShowLD(false)} scores={hsScores} current={bestStreak} />
      <div style={{ padding: '28px 32px', display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div className="page-title">Match Bet</div>
          <div className="page-sub">{leagueNames[leagueId]} · Guess the score · Exact score = triple points!</div>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          {bestStreak > 0 && (
            <div style={{ background: 'rgba(255,180,0,0.1)', border: '1px solid rgba(255,180,0,0.25)', borderRadius: 12, padding: '8px 14px', textAlign: 'center' }}>
              <div style={{ fontSize: 9, color: 'var(--amber)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>Best</div>
              <div style={{ fontSize: 20, fontWeight: 900, color: 'var(--amber)', lineHeight: 1 }}>{bestStreak}</div>
            </div>
          )}
          <button onClick={() => { loadScores(); setShowLD(true) }}
            style={{ background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: 12, padding: '8px 14px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, color: 'var(--amber)', fontWeight: 700, fontSize: 12 }}>
            <Icons.Trophy size={16} color="var(--amber)" />
            Leaderboard
          </button>
          {streak >= 2 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(255,167,38,0.1)', border: '1px solid rgba(255,167,38,0.3)', borderRadius: 12, padding: '10px 18px' }}>
              <Icons.Flame size={18} color="var(--amber)" />
              <div>
                <div style={{ fontSize: 9, color: 'var(--amber)', fontWeight: 700, textTransform: 'uppercase' }}>Streak</div>
                <div style={{ fontSize: 22, fontWeight: 900, color: 'var(--amber)', lineHeight: 1 }}>{streak}</div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Points legend */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        {[
          { label: 'Exact score', pts: '+300', color: 'var(--purple)' },
          { label: 'Correct outcome', pts: '+100', color: 'var(--green)' },
          { label: 'Wrong', pts: '−50', color: 'var(--red)' },
        ].map(({ label, pts, color }) => (
          <div key={label} style={{ background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: 10, padding: '7px 14px', display: 'flex', gap: 6, alignItems: 'center', fontSize: 12 }}>
            <span style={{ color, fontWeight: 800 }}>{pts}</span>
            <span style={{ color: 'var(--text3)' }}>{label}</span>
          </div>
        ))}
        <div style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--text3)', alignSelf: 'center' }}>
          The away team becomes the home team next round
        </div>
      </div>

      {/* ── Matchday Card ── */}
      <div style={{
        background: 'var(--bg2)', border: '1px solid var(--border)',
        borderRadius: 20, overflow: 'hidden',
        display: 'grid', gridTemplateColumns: '1fr 180px 1fr',
        minHeight: 400,
      }}>
        {/* HOME */}
        <TeamCard
          team={home}
          score={guessH}
          onScore={setGuessH}
          color="var(--blue)"
          label="Home"
          revealed={revealed}
          eloRating={result?.homeElo}
          disabled={!playing}
        />

        {/* CENTER */}
        <div style={{
          background: 'var(--bg3)', borderInline: '1px solid var(--border)',
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', padding: 20, gap: 16,
        }}>
          {/* Your prediction */}
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 9, color: 'var(--text3)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>Your Prediction</div>
            <div style={{ fontSize: 28, fontWeight: 900, letterSpacing: 4 }}>
              <span style={{ color: 'var(--blue)' }}>{guessH}</span>
              <span style={{ color: 'var(--text3)', marginInline: 4 }}>–</span>
              <span style={{ color: 'var(--amber)' }}>{guessA}</span>
            </div>
          </div>

          {playing && (
            <button
              onClick={lockIn}
              className="btn btn-primary"
              style={{ width: '100%', justifyContent: 'center', padding: '14px 0' }}
            >
              <Icons.Lock size={14} />
              Lock In
            </button>
          )}

          {/* Result reveal */}
          {revealed && result && (
            <div className="animate-scale" style={{
              width: '100%', textAlign: 'center', padding: '16px 12px',
              borderRadius: 14,
              background: result.correct ? 'rgba(0,230,118,0.08)' : 'rgba(255,71,87,0.08)',
              border: `1px solid ${result.correct ? 'rgba(0,230,118,0.3)' : 'rgba(255,71,87,0.3)'}`,
            }}>
              <div style={{ fontSize: 13, color: 'var(--text3)', marginBottom: 8 }}>Actual Score</div>
              <div style={{ fontSize: 30, fontWeight: 900, letterSpacing: 4, marginBottom: 10 }}>
                <span style={{ color: result.home_goals > result.away_goals ? 'var(--green)' : 'var(--text)' }}>
                  {result.home_goals}
                </span>
                <span style={{ color: 'var(--text3)', marginInline: 4 }}>–</span>
                <span style={{ color: result.away_goals > result.home_goals ? 'var(--green)' : 'var(--text)' }}>
                  {result.away_goals}
                </span>
              </div>
              <div style={{ fontWeight: 700, fontSize: 13, color: result.correct ? 'var(--green)' : 'var(--red)', marginBottom: 4 }}>
                {result.tag}
              </div>
              <div style={{ fontSize: 22, fontWeight: 900, color: result.gain > 0 ? 'var(--green)' : 'var(--red)', marginBottom: 14 }}>
                {result.gain > 0 ? '+' : ''}{result.gain} pts
              </div>

              {/* Strength bar — revealed after guess */}
              {result.homeElo && result.awayElo && (
                <div style={{ marginBottom: 14 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--text3)', marginBottom: 4, fontWeight: 600 }}>
                    <span>Home strength</span>
                    <span>Away strength</span>
                  </div>
                  <div style={{ height: 6, background: 'var(--bg5)', borderRadius: 3, overflow: 'hidden', display: 'flex' }}>
                    {(() => {
                      const total = result.homeElo + result.awayElo
                      const hp = Math.round((result.homeElo / total) * 100)
                      return (
                        <>
                          <div style={{ width: `${hp}%`, background: 'var(--blue)' }} />
                          <div style={{ flex: 1, background: 'var(--amber)' }} />
                        </>
                      )
                    })()}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginTop: 4 }}>
                    <span style={{ color: 'var(--blue)', fontWeight: 700 }}>Elo {result.homeElo}</span>
                    <span style={{ color: 'var(--amber)', fontWeight: 700 }}>Elo {result.awayElo}</span>
                  </div>
                </div>
              )}

              <button onClick={nextMatch} className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }}>
                <Icons.Refresh size={14} />
                Next Match
              </button>
            </div>
          )}
        </div>

        {/* AWAY */}
        <TeamCard
          team={away}
          score={guessA}
          onScore={setGuessA}
          color="var(--amber)"
          label="Away  →  Home next"
          revealed={revealed}
          eloRating={result?.awayElo}
          disabled={!playing}
        />
      </div>

      {/* History */}
      {history.length > 0 && (
        <div className="card">
          <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', fontWeight: 700, fontSize: 13 }}>Recent Bets</div>
          {history.map((h, i) => (
            <div key={i} style={{ padding: '12px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 16, justifyContent: 'space-between', fontSize: 13 }}>
              <div style={{ flex: 1 }}>
                <span style={{ fontWeight: 600 }}>{h.home}</span>
                <span style={{ color:'var(--text3)', marginInline:6 }}>{h.score}</span>
                <span style={{ fontWeight: 600 }}>{h.away}</span>
                <span style={{ color:'var(--text3)', marginLeft:8, fontSize:11 }}>· Guess: {h.guess}</span>
                {h.exact && <span className="badge badge-purple" style={{ marginLeft:8, fontSize:10 }}>Exact!</span>}
              </div>
              <span style={{ fontWeight:700, color: h.gain > 0 ? 'var(--green)' : 'var(--red)', flexShrink:0 }}>
                {h.gain > 0 ? '+' : ''}{h.gain}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
    </>
  )
}
