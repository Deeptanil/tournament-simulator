import { useState, useEffect, useCallback, useRef } from 'react'
import { getInitialPlayerPair, getNextPlayer, getHighScores, postHighScore } from '../api'
import { Icons } from '../Icons'

const fmt = (v) => {
  if (v >= 1_000_000) return `€${(v / 1_000_000).toFixed(0)}M`
  if (v >= 1_000)     return `€${(v / 1_000).toFixed(0)}K`
  return `€${v}`
}

const HISTORY_SIZE = 8
const recentIds = []
const markSeen        = (id) => { recentIds.push(id); if (recentIds.length > HISTORY_SIZE) recentIds.shift() }
const wasRecentlySeen = (id) => recentIds.includes(id)

// ── High Score Panel ──────────────────────────────────────────────────────────
function HighScorePanel({ show, onClose, scores, current }) {
  if (!show) return null
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 200,
      background: 'rgba(8,11,20,0.85)', backdropFilter: 'blur(8px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }} onClick={onClose}>
      <div style={{
        background: 'var(--bg2)', border: '1px solid var(--border2)',
        borderRadius: 24, padding: '36px 40px', minWidth: 360, maxWidth: 440,
        boxShadow: '0 40px 80px rgba(0,0,0,0.6)',
      }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
          <Icons.Trophy size={28} color="var(--amber)" />
          <div>
            <div style={{ fontWeight: 800, fontSize: 18 }}>Leaderboard</div>
            <div style={{ fontSize: 12, color: 'var(--text3)' }}>Higher or Lower — Best Streaks</div>
          </div>
        </div>
        {scores.length === 0 && (
          <div style={{ color: 'var(--text3)', textAlign: 'center', padding: 20 }}>No scores yet. Be the first!</div>
        )}
        {scores.map((s, i) => (
          <div key={i} style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '10px 14px', borderRadius: 10, marginBottom: 6,
            background: i === 0 ? 'rgba(255,180,0,0.1)' : 'var(--bg3)',
            border: `1px solid ${i === 0 ? 'rgba(255,180,0,0.25)' : 'var(--border)'}`,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontWeight: 800, color: i === 0 ? 'var(--amber)' : i === 1 ? '#C0C0C0' : i === 2 ? '#CD7F32' : 'var(--text3)', minWidth: 20 }}>
                {i === 0 ? '🏆' : `#${i + 1}`}
              </span>
              <span style={{ fontWeight: 600 }}>Streak</span>
            </div>
            <span style={{ fontWeight: 800, fontSize: 18, color: i === 0 ? 'var(--amber)' : 'var(--text)' }}>
              {s.score}
            </span>
          </div>
        ))}
        {current > 0 && (
          <div style={{ marginTop: 16, padding: '12px 14px', borderRadius: 10,
            background: 'rgba(0,230,118,0.08)', border: '1px solid rgba(0,230,118,0.2)',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          }}>
            <span style={{ color: 'var(--green)', fontWeight: 700 }}>Your Best</span>
            <span style={{ color: 'var(--green)', fontWeight: 800, fontSize: 18 }}>{current}</span>
          </div>
        )}
        <button onClick={onClose} className="btn btn-primary" style={{ width: '100%', marginTop: 20 }}>
          Close
        </button>
      </div>
    </div>
  )
}

export default function TransferMinigame({ points, setPoints }) {
  const [left,    setLeft]    = useState(null)
  const [right,   setRight]   = useState(null)
  const [queue,   setQueue]   = useState([])
  const [phase,   setPhase]   = useState('loading')
  const [streak,  setStreak]  = useState(0)
  const [bestStreak, setBestStreak] = useState(() => parseInt(localStorage.getItem('hl_best') || '0'))
  const [message, setMessage] = useState('')
  const [showLD,  setShowLD]  = useState(false)
  const [scores,  setScores]  = useState([])
  const [loadingNext, setLoadingNext] = useState(false)

  const fetching = useRef(false)

  const loadScores = useCallback(() => {
    getHighScores('higher_lower').then(setScores).catch(() => {})
  }, [])

  useEffect(() => { loadScores() }, [])

  const updateBest = useCallback((s) => {
    if (s > bestStreak) {
      setBestStreak(s)
      localStorage.setItem('hl_best', s)
      postHighScore('higher_lower', s).then(loadScores)
    }
  }, [bestStreak, loadScores])

  const fetchFresh = useCallback(async (excludeId) => {
    let tries = 0
    while (tries < 5) {
      const p = await getNextPlayer(excludeId)
      if (!p || p.error) break
      if (p.id !== excludeId && !wasRecentlySeen(p.id)) return p
      tries++
    }
    return await getNextPlayer(excludeId)
  }, [])

  useEffect(() => {
    setPhase('loading')
    ;(async () => {
      const pair = await getInitialPlayerPair()
      if (!pair || pair.length < 2) return
      const [p1, p2] = pair
      markSeen(p1.id); markSeen(p2.id)
      setLeft(p1); setRight(p2)
      const p3 = await fetchFresh(p2.id)
      if (p3) setQueue([p3])
      setPhase('playing')
    })()
  }, [])

  const handleGuess = async (guess) => {
    if (phase !== 'playing' || !left || !right) return
    const lv = left.transfer_value
    const rv = right.transfer_value
    const correct = (guess === 'higher' && rv >= lv) || (guess === 'lower' && rv <= lv)

    if (correct) {
      const newStreak  = streak + 1
      const multiplier = newStreak >= 4 ? 3 : newStreak >= 2 ? 2 : 1
      const gain       = 100 * multiplier
      setPoints(points + gain)
      setStreak(newStreak)
      updateBest(newStreak)
      setMessage(multiplier > 1 ? `${multiplier}× Combo! +${gain} pts` : `Correct! +${gain} pts`)
      setPhase('reveal-correct')

      setTimeout(async () => {
        setPhase('transitioning')
        setLoadingNext(true)
        const newLeft  = right
        const newRight = queue[0] || null
        markSeen(newLeft.id)
        if (newRight) markSeen(newRight.id)
        setLeft(newLeft); setRight(newRight)
        
        const upcoming = await fetchFresh(newRight?.id ?? newLeft.id)
        setQueue(upcoming ? [upcoming] : [])
        setLoadingNext(false)
        setPhase('playing')
      }, 1500)

    } else {
      updateBest(streak)
      setPoints(Math.max(0, points - 50))
      setStreak(0)
      setMessage(`Wrong! −50 pts`)
      setPhase('reveal-wrong')

      setTimeout(async () => {
        setPhase('transitioning')
        setLoadingNext(true)
        const fresh1 = await fetchFresh(right.id)
        const fresh2 = await fetchFresh(fresh1?.id ?? 0)
        markSeen(fresh1?.id); markSeen(fresh2?.id)
        setLeft(fresh1); setRight(fresh2)
        const upcoming = await fetchFresh(fresh2?.id ?? 0)
        setQueue(upcoming ? [upcoming] : [])
        setLoadingNext(false)
        setPhase('playing')
      }, 2000)
    }
  }

  const revealed   = phase === 'reveal-correct' || phase === 'reveal-wrong'
  const isPlaying  = phase === 'playing'
  const comboColor = streak >= 4 ? 'var(--purple)' : streak >= 2 ? 'var(--amber)' : 'var(--green)'

  if (phase === 'loading' || !left || !right) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '80vh', gap: 16, flexDirection: 'column' }}>
        <span className="spinner-ring" style={{ width: 48, height: 48, borderWidth: 3 }} />
        <div style={{ color: 'var(--text2)', fontSize: 14 }}>Loading players…</div>
      </div>
    )
  }

  return (
    <>
      <HighScorePanel show={showLD} onClose={() => setShowLD(false)} scores={scores} current={bestStreak} />
      <div style={{ padding: '28px 32px', display: 'flex', flexDirection: 'column', gap: 20, minHeight: '100%' }}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div className="page-title">Higher or Lower</div>
            <div className="page-sub">Is the right player's transfer value higher or lower?</div>
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            {/* Best streak */}
            {bestStreak > 0 && (
              <div style={{ background: 'rgba(255,180,0,0.1)', border: '1px solid rgba(255,180,0,0.25)', borderRadius: 12, padding: '8px 14px', textAlign: 'center' }}>
                <div style={{ fontSize: 9, color: 'var(--amber)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>Best</div>
                <div style={{ fontSize: 20, fontWeight: 900, color: 'var(--amber)', lineHeight: 1 }}>{bestStreak}</div>
              </div>
            )}
            {/* Leaderboard button */}
            <button onClick={() => { loadScores(); setShowLD(true) }}
              style={{ background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: 12, padding: '8px 14px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, color: 'var(--amber)', fontWeight: 700, fontSize: 12 }}>
              <Icons.Trophy size={16} color="var(--amber)" />
              Leaderboard
            </button>
            {/* Current streak */}
            <div style={{ background: `${comboColor}15`, border: `1px solid ${comboColor}35`, borderRadius: 12, padding: '8px 14px', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Icons.Flame size={18} color={comboColor} />
              <div>
                <div style={{ fontSize: 9, color: comboColor, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>Streak</div>
                <div style={{ fontSize: 24, fontWeight: 900, color: comboColor, lineHeight: 1 }}>{streak}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Game area */}
        <div style={{
          display: 'grid', gridTemplateColumns: '1fr 260px 1fr',
          background: 'var(--bg2)', border: '1px solid var(--border)',
          borderRadius: 20, overflow: 'hidden', minHeight: 480,
        }}>
        <div style={{ position: 'relative', flex: 1, minHeight: 480, display: 'flex' }}>
          <PlayerPanel player={left}  showValue={true}   side="left"  />
        </div>

          {/* Center panel */}
          <div style={{
            background: 'var(--bg3)', borderInline: '1px solid var(--border)',
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            padding: 24, gap: 20,
          }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', letterSpacing: 2 }}>VS</div>
            <div style={{ textAlign: 'center', fontSize: 13, color: 'var(--text2)', lineHeight: 1.6 }}>
              Does <strong style={{ color: 'var(--text)' }}>{right.name}</strong> have a{' '}
              <span style={{ color: 'var(--green)', fontWeight: 700 }}>HIGHER</span> or{' '}
              <span style={{ color: 'var(--red)', fontWeight: 700 }}>LOWER</span> market value than{' '}
              <strong style={{ color: 'var(--text)' }}>{left.name}</strong>?
            </div>

            {revealed && (
              <div className="animate-scale" style={{
                textAlign: 'center', padding: '14px 18px', borderRadius: 14, width: '100%',
                background: phase === 'reveal-correct' ? 'rgba(0,230,118,0.1)' : 'rgba(255,71,87,0.1)',
                border: `1px solid ${phase === 'reveal-correct' ? 'rgba(0,230,118,0.3)' : 'rgba(255,71,87,0.3)'}`,
              }}>
                <div style={{ marginBottom: 6 }}>
                  {phase === 'reveal-correct' ? <Icons.Check size={28} color="var(--green)" /> : <Icons.X size={28} color="var(--red)" />}
                </div>
                <div style={{ fontWeight: 800, fontSize: 15, color: phase === 'reveal-correct' ? 'var(--green)' : 'var(--red)' }}>
                  {message}
                </div>
              </div>
            )}

            {isPlaying && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, width: '100%' }}>
                {[
                  { guess: 'higher', label: 'HIGHER', Icon: Icons.ArrowUp, color: 'var(--green)', bg: 'rgba(0,230,118,0.1)', border: 'rgba(0,230,118,0.35)', hoverBg: 'rgba(0,230,118,0.2)' },
                  { guess: 'lower',  label: 'LOWER',  Icon: Icons.ArrowDown, color: 'var(--red)',   bg: 'rgba(255,71,87,0.1)', border: 'rgba(255,71,87,0.35)',  hoverBg: 'rgba(255,71,87,0.2)' },
                ].map(({ guess, label, Icon, color, bg, border, hoverBg }) => (
                  <button key={guess} onClick={() => handleGuess(guess)}
                    style={{ width: '100%', padding: '16px 0', border: `1px solid ${border}`, borderRadius: 12, background: bg, color, fontWeight: 800, fontSize: 15, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, transition: 'all 0.18s', fontFamily: 'Inter, sans-serif', letterSpacing: 1 }}
                    onMouseEnter={e => { e.currentTarget.style.background = hoverBg; e.currentTarget.style.transform = 'scale(1.02)' }}
                    onMouseLeave={e => { e.currentTarget.style.background = bg;      e.currentTarget.style.transform = 'scale(1)' }}
                  >
                    <Icon size={18} /> {label}
                  </button>
                ))}
              </div>
            )}

            {streak >= 2 && isPlaying && (
              <div style={{ fontSize: 11, color: comboColor, fontWeight: 800, letterSpacing: 0.5 }}>
                {streak >= 4 ? '3×' : '2×'} COMBO ACTIVE
              </div>
            )}
          </div>

          <div style={{ position: 'relative', flex: 1, minHeight: 480, display: 'flex' }}>
            <PlayerPanel player={right} showValue={revealed} side="right" dim={revealed && phase === 'reveal-wrong'} isLoading={loadingNext} />
            {loadingNext && (
              <div style={{
                position: 'absolute', inset: 0, zIndex: 10,
                background: 'rgba(8,11,20,0.4)', backdropFilter: 'blur(4px)',
                display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}>
                <span className="spinner-ring" style={{ width: 40, height: 40 }} />
              </div>
            )}
          </div>
        </div>

        {/* Points legend */}
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {[
            { label: 'Correct',    pts: '+100', color: 'var(--green)'  },
            { label: '2+ streak',  pts: '+200', color: 'var(--amber)'  },
            { label: '4+ streak',  pts: '+300', color: 'var(--purple)' },
            { label: 'Wrong',      pts: '−50',  color: 'var(--red)'    },
          ].map(({ label, pts, color }) => (
            <div key={label} style={{ background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: 10, padding: '7px 14px', display: 'flex', gap: 6, alignItems: 'center', fontSize: 12 }}>
              <span style={{ color, fontWeight: 800 }}>{pts}</span>
              <span style={{ color: 'var(--text3)' }}>{label}</span>
            </div>
          ))}
        </div>
      </div>
    </>
  )
}

function PlayerPanel({ player, showValue, side, dim, isLoading }) {
  if (!player) return <div style={{ flex: 1, background: 'var(--bg3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><span className="spinner-ring" /></div>
  const isLeft    = side === 'left'
  const accent    = isLeft ? 'var(--blue)' : 'var(--purple)'
  const accentAlpha = isLeft ? 'rgba(79,195,247,0.12)' : 'rgba(168,85,247,0.12)'
  
  return (
    <div style={{ 
      flex: 1,
      display: 'flex', 
      flexDirection: 'column', 
      alignItems: 'center', 
      justifyContent: 'center', 
      padding: '40px 32px', 
      gap: 20, 
      position: 'relative', 
      overflow: 'hidden', 
      background: accentAlpha, 
      filter: dim ? 'brightness(0.7)' : 'brightness(1)', 
      transition: 'all 0.5s ease',
      opacity: isLoading ? 0.5 : 1,
      transform: isLoading ? 'scale(0.98)' : 'scale(1)'
    }}>
      {player.image_url && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 0, backgroundImage: `url(${player.image_url})`, backgroundSize: 'cover', backgroundPosition: 'center top', filter: 'grayscale(0.8) opacity(0.12)' }} />
      )}
      
      <div style={{ position: 'relative', zIndex: 1, width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
        <div style={{ width: 120, height: 120, borderRadius: '50%', border: `3px solid ${accent}40`, overflow: 'hidden', background: accentAlpha, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `0 0 40px ${accent}20`, flexShrink: 0 }}>
          {player.image_url ? (
            <img src={player.image_url} alt={player.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={e => { e.target.style.display = 'none' }} />
          ) : (
            <Icons.Shield size={48} color={accent} />
          )}
        </div>

        <div style={{ textAlign: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginBottom: 4 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: accent }} />
            <span style={{ fontSize: 11, fontWeight: 700, color: accent, textTransform: 'uppercase', letterSpacing: 1.5 }}>{player.team_name}</span>
          </div>
          <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.3px' }}>{player.name}</div>
          
          {/* Metadata Row */}
          <div className="animate-in" style={{ 
            display: 'flex', 
            gap: '8px', 
            justifyContent: 'center', 
            marginTop: '12px', 
            flexWrap: 'wrap' 
          }}>
            {player.position && (
              <span style={{ 
                fontSize: '10px', 
                background: 'rgba(255,255,255,0.08)', 
                padding: '4px 10px', 
                borderRadius: '20px', 
                color: 'var(--text)', 
                border: '1px solid rgba(255,255,255,0.1)',
                fontWeight: 600,
                textShadow: '0 1px 2px rgba(0,0,0,0.5)'
              }}>
                {player.position}
              </span>
            )}
            {player.height > 0 && (
              <span style={{ 
                fontSize: '10px', 
                background: 'rgba(255,255,255,0.08)', 
                padding: '4px 10px', 
                borderRadius: '20px', 
                color: 'var(--text)', 
                border: '1px solid rgba(255,255,255,0.1)',
                fontWeight: 600,
                textShadow: '0 1px 2px rgba(0,0,0,0.5)'
              }}>
                {player.height} cm
              </span>
            )}
            {player.foot && (
              <span style={{ 
                fontSize: '10px', 
                background: 'rgba(255,255,255,0.08)', 
                padding: '4px 10px', 
                borderRadius: '20px', 
                color: 'var(--text)', 
                border: '1px solid rgba(255,255,255,0.1)',
                fontWeight: 600,
                textTransform: 'capitalize',
                textShadow: '0 1px 2px rgba(0,0,0,0.5)'
              }}>
                {player.foot.toLowerCase() === 'right' ? 'Right' : player.foot.toLowerCase() === 'left' ? 'Left' : player.foot}
              </span>
            )}
          </div>
        </div>

        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 6 }}>
            {showValue ? 'Market Value' : '???'}
          </div>
          <div style={{ fontSize: showValue ? 40 : 28, fontWeight: 900, color: showValue ? accent : 'var(--text3)', letterSpacing: '-1px', transition: 'all 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)', minHeight: 50, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {showValue ? fmt(player.transfer_value) : '—'}
          </div>
          {showValue && <div style={{ fontStyle: 'italic', fontSize: 10, color: 'var(--text3)', marginTop: 4 }}>Transfer Value</div>}
        </div>
      </div>
    </div>
  )
}
