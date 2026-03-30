import { useState, useEffect, useCallback, useRef } from 'react'
import { getInitialPlayerPair, getNextPlayer } from '../api'
import { Icons } from '../Icons'

const fmt = (v) => {
  if (v >= 1_000_000) return `€${(v / 1_000_000).toFixed(0)}M`
  if (v >= 1_000)     return `€${(v / 1_000).toFixed(0)}K`
  return `€${v}`
}

// Keeps a rolling "recently seen" list so we don't repeat quickly
const HISTORY_SIZE = 8
const recentIds = []
const markSeen = (id) => {
  recentIds.push(id)
  if (recentIds.length > HISTORY_SIZE) recentIds.shift()
}
const wasRecentlySeen = (id) => recentIds.includes(id)

export default function TransferMinigame({ points, setPoints }) {
  const [left,  setLeft]   = useState(null)   // known player
  const [right, setRight]  = useState(null)   // mystery player
  const [queue, setQueue]  = useState([])     // pre-fetched upcoming player
  const [phase, setPhase]  = useState('loading') // loading | playing | reveal-correct | reveal-wrong | transitioning
  const [streak, setStreak]   = useState(0)
  const [message, setMessage] = useState('')
  const fetching = useRef(false)

  // Fetch a player different from the given id(s), not recently seen
  const fetchFresh = useCallback(async (excludeId) => {
    let tries = 0
    while (tries < 5) {
      const p = await getNextPlayer(excludeId)
      if (!p || p.error) break
      if (p.id !== excludeId && !wasRecentlySeen(p.id)) return p
      tries++
    }
    const p = await getNextPlayer(excludeId)
    return p
  }, [])

  // Initial load
  useEffect(() => {
    setPhase('loading')
    ;(async () => {
      const pair = await getInitialPlayerPair()
      if (!pair || pair.length < 2) return
      const [p1, p2] = pair
      markSeen(p1.id)
      markSeen(p2.id)
      setLeft(p1)
      setRight(p2)
      // pre-fetch next
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
      setMessage(multiplier > 1 ? `${multiplier}× Combo! +${gain} pts` : `Correct! +${gain} pts`)
      setPhase('reveal-correct')

      // After 1.5s: slide right → left, queue → right
      setTimeout(async () => {
        setPhase('transitioning')
        const newLeft  = right
        const newRight = queue[0] || null
        markSeen(newLeft.id)
        if (newRight) markSeen(newRight.id)
        setLeft(newLeft)
        setRight(newRight)

        // Pre-fetch next
        const upcoming = await fetchFresh(newRight?.id ?? newLeft.id)
        setQueue(upcoming ? [upcoming] : [])
        setPhase('playing')
      }, 1500)

    } else {
      const loss = -50
      setPoints(Math.max(0, points + loss))
      setStreak(0)
      setMessage(`Wrong! −50 pts`)
      setPhase('reveal-wrong')

      setTimeout(async () => {
        setPhase('transitioning')
        // Full reset with a fresh pair
        const fresh1 = await fetchFresh(right.id)
        const fresh2 = await fetchFresh(fresh1?.id ?? 0)
        markSeen(fresh1?.id)
        markSeen(fresh2?.id)
        setLeft(fresh1)
        setRight(fresh2)
        const upcoming = await fetchFresh(fresh2?.id ?? 0)
        setQueue(upcoming ? [upcoming] : [])
        setPhase('playing')
      }, 2000)
    }
  }

  const revealed = phase === 'reveal-correct' || phase === 'reveal-wrong'
  const isPlaying = phase === 'playing'
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
    <div style={{ padding: '28px 32px', display: 'flex', flexDirection: 'column', gap: 20, minHeight: '100%' }}>
      {/* Header row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div className="page-title">Higher or Lower</div>
          <div className="page-sub">Is the right player's transfer value higher or lower?</div>
        </div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <div style={{ background: `${comboColor}15`, border: `1px solid ${comboColor}35`, borderRadius: 12, padding: '10px 18px', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Icons.Flame size={18} color={comboColor} />
            <div>
              <div style={{ fontSize: 9, color: comboColor, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>Streak</div>
              <div style={{ fontSize: 24, fontWeight: 900, color: comboColor, lineHeight: 1 }}>{streak}</div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Main Game Area ── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 260px 1fr',
        background: 'var(--bg2)',
        border: '1px solid var(--border)',
        borderRadius: 20,
        overflow: 'hidden',
        minHeight: 480,
      }}>

        {/* LEFT — Known player */}
        <PlayerPanel player={left} showValue={true} side="left" />

        {/* CENTER — VS + controls */}
        <div style={{
          background: 'var(--bg3)',
          borderInline: '1px solid var(--border)',
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          padding: 24, gap: 20,
        }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', letterSpacing: 2 }}>VS</div>

          {/* Question text */}
          <div style={{ textAlign: 'center', fontSize: 13, color: 'var(--text2)', lineHeight: 1.6 }}>
            Does <strong style={{ color: 'var(--text)' }}>{right.name}</strong> have a{' '}
            <span style={{ color: 'var(--green)', fontWeight: 700 }}>HIGHER</span> or{' '}
            <span style={{ color: 'var(--red)', fontWeight: 700 }}>LOWER</span> market value than{' '}
            <strong style={{ color: 'var(--text)' }}>{left.name}</strong>?
          </div>

          {/* Feedback bubble */}
          {revealed && (
            <div className="animate-scale" style={{
              textAlign: 'center', padding: '14px 18px', borderRadius: 14, width: '100%',
              background: phase === 'reveal-correct' ? 'rgba(0,230,118,0.1)' : 'rgba(255,71,87,0.1)',
              border: `1px solid ${phase === 'reveal-correct' ? 'rgba(0,230,118,0.3)' : 'rgba(255,71,87,0.3)'}`,
            }}>
              <div style={{ marginBottom: 6 }}>
                {phase === 'reveal-correct'
                  ? <Icons.Check size={28} color="var(--green)" />
                  : <Icons.X size={28} color="var(--red)" />}
              </div>
              <div style={{ fontWeight: 800, fontSize: 15, color: phase === 'reveal-correct' ? 'var(--green)' : 'var(--red)' }}>
                {message}
              </div>
            </div>
          )}

          {/* Buttons */}
          {isPlaying && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, width: '100%' }}>
              <button
                onClick={() => handleGuess('higher')}
                style={{
                  width: '100%', padding: '16px 0', border: '1px solid rgba(0,230,118,0.35)',
                  borderRadius: 12, background: 'rgba(0,230,118,0.1)',
                  color: 'var(--green)', fontWeight: 800, fontSize: 15, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  transition: 'all 0.18s', fontFamily: 'Inter, sans-serif',
                  letterSpacing: 1,
                }}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(0,230,118,0.2)'; e.currentTarget.style.transform = 'scale(1.02)' }}
                onMouseLeave={e => { e.currentTarget.style.background = 'rgba(0,230,118,0.1)'; e.currentTarget.style.transform = 'scale(1)' }}
              >
                <Icons.ArrowUp size={18} /> HIGHER
              </button>
              <button
                onClick={() => handleGuess('lower')}
                style={{
                  width: '100%', padding: '16px 0', border: '1px solid rgba(255,71,87,0.35)',
                  borderRadius: 12, background: 'rgba(255,71,87,0.1)',
                  color: 'var(--red)', fontWeight: 800, fontSize: 15, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  transition: 'all 0.18s', fontFamily: 'Inter, sans-serif',
                  letterSpacing: 1,
                }}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,71,87,0.2)'; e.currentTarget.style.transform = 'scale(1.02)' }}
                onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,71,87,0.1)'; e.currentTarget.style.transform = 'scale(1)' }}
              >
                <Icons.ArrowDown size={18} /> LOWER
              </button>
            </div>
          )}

          {/* Combo badge */}
          {streak >= 2 && isPlaying && (
            <div style={{ fontSize: 11, color: comboColor, fontWeight: 800, letterSpacing: 0.5 }}>
              {streak >= 4 ? '3×' : '2×'} COMBO ACTIVE
            </div>
          )}
        </div>

        {/* RIGHT — Mystery player */}
        <PlayerPanel player={right} showValue={revealed} side="right" dim={!revealed} />
      </div>

      {/* Points legend */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        {[
          { label: 'Correct', pts: '+100',  color: 'var(--green)' },
          { label: '2+ streak', pts: '+200', color: 'var(--amber)' },
          { label: '4+ streak', pts: '+300', color: 'var(--purple)' },
          { label: 'Wrong',   pts: '−50',   color: 'var(--red)' },
        ].map(({ label, pts, color }) => (
          <div key={label} style={{
            background: 'var(--bg3)', border: '1px solid var(--border2)',
            borderRadius: 10, padding: '7px 14px',
            display: 'flex', gap: 6, alignItems: 'center', fontSize: 12,
          }}>
            <span style={{ color, fontWeight: 800 }}>{pts}</span>
            <span style={{ color: 'var(--text3)' }}>{label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function PlayerPanel({ player, showValue, side, dim }) {
  if (!player) return <div style={{ flex: 1 }} />

  const isLeft  = side === 'left'
  const accent  = isLeft ? 'var(--blue)' : 'var(--purple)'
  const accentAlpha = isLeft ? 'rgba(79,195,247,0.12)' : 'rgba(168,85,247,0.12)'

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', padding: '40px 32px', gap: 20,
      position: 'relative', overflow: 'hidden',
      background: accentAlpha,
      filter: dim ? 'brightness(0.7)' : 'brightness(1)',
      transition: 'filter 0.4s',
    }}>
      {/* Background player image (faded) */}
      {player.image_url && (
        <div style={{
          position: 'absolute', inset: 0, zIndex: 0,
          backgroundImage: `url(${player.image_url})`,
          backgroundSize: 'cover', backgroundPosition: 'center top',
          filter: 'grayscale(0.8) opacity(0.12)',
        }} />
      )}

      {/* Content — above background */}
      <div style={{ position: 'relative', zIndex: 1, width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>

        {/* Player photo circle */}
        <div style={{
          width: 120, height: 120, borderRadius: '50%',
          border: `3px solid ${accent}40`,
          overflow: 'hidden',
          background: accentAlpha,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: `0 0 40px ${accent}20`,
          flexShrink: 0,
        }}>
          {player.image_url ? (
            <img src={player.image_url} alt={player.name}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              onError={e => { e.target.style.display = 'none' }}
            />
          ) : (
            <Icons.Shield size={48} color={accent} />
          )}
        </div>

        {/* Name & team */}
        <div style={{ textAlign: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginBottom: 4 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: accent }} />
            <span style={{ fontSize: 11, fontWeight: 700, color: accent, textTransform: 'uppercase', letterSpacing: 1.5 }}>
              {player.team_name}
            </span>
          </div>
          <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.3px' }}>
            {player.name}
          </div>
        </div>

        {/* Value */}
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 6 }}>
            {showValue ? 'Market Value' : '???'}
          </div>
          <div style={{
            fontSize: showValue ? 40 : 28,
            fontWeight: 900,
            color: showValue ? accent : 'var(--text3)',
            letterSpacing: '-1px',
            transition: 'all 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)',
            minHeight: 50,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            {showValue ? fmt(player.transfer_value) : '—'}
          </div>
          {showValue && (
            <div style={{ fontStyle: 'italic', fontSize: 10, color: 'var(--text3)', marginTop: 4 }}>
              Transfer Value
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
