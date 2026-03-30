import { useState } from 'react'
import { Routes, Route, NavLink } from 'react-router-dom'
import { Icons } from './Icons'
import Simulate      from './pages/Simulate.jsx'
import Groups        from './pages/Groups.jsx'
import Bracket       from './pages/Bracket.jsx'
import Teams         from './pages/Teams.jsx'
import Matches       from './pages/Matches.jsx'
import MatchesBetting from './pages/MatchesBetting.jsx'
import TransferMinigame from './pages/TransferMinigame.jsx'
import './App.css'

const LEAGUES = [
  { id: 39,  name: 'Premier League', country: 'England', flagCode: 'gb-eng' },
  { id: 140, name: 'La Liga',        country: 'Spain',   flagCode: 'es' },
  { id: 135, name: 'Serie A',        country: 'Italy',   flagCode: 'it' },
]

const NAV_MAIN = [
  { to: '/simulate', label: 'Simulate',    Icon: Icons.Simulate },
  { to: '/groups',   label: 'Groups',      Icon: Icons.Grid },
  { to: '/bracket',  label: 'Bracket',     Icon: Icons.Bracket },
  { to: '/teams',    label: 'Teams',       Icon: Icons.Shield },
  { to: '/matches',  label: 'Matches',     Icon: Icons.Calendar },
]
const NAV_GAMES = [
  { to: '/betting',  label: 'Match Bet',   Icon: Icons.Coins },
  { to: '/transfer', label: 'Higher/Lower', Icon: Icons.TrendingUp },
]

export default function App() {
  const [leagueId, setLeagueId] = useState(39)
  const [points, setPoints]     = useState(() => parseInt(localStorage.getItem('points')) || 1000)

  const updatePoints = (newPts) => {
    setPoints(newPts)
    localStorage.setItem('points', newPts)
  }

  const shared = { leagueId, points, setPoints: updatePoints }

  return (
    <div className="layout">
      {/* ── Sidebar ── */}
      <nav className="sidebar">
        {/* Logo */}
        <div className="sidebar-logo">
          <div className="logo-icon-wrap">
            <Icons.Ball size={22} color="#000" />
          </div>
          <div>
            <div className="logo-text">Tournament<br/>Simulator</div>
            <div className="logo-sub">Powered by Elo & Monte Carlo</div>
          </div>
        </div>

        {/* Nav */}
        <div className="sidebar-nav">
          <div className="sidebar-section-label">Analytics</div>
          {NAV_MAIN.map(({ to, label, Icon }) => (
            <NavLink key={to} to={to} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
              <span className="nav-icon"><Icon size={16} /></span>
              <span>{label}</span>
            </NavLink>
          ))}

          <div className="sidebar-section-label" style={{ marginTop: 8 }}>Games</div>
          {NAV_GAMES.map(({ to, label, Icon }) => (
            <NavLink key={to} to={to} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
              <span className="nav-icon"><Icon size={16} /></span>
              <span>{label}</span>
            </NavLink>
          ))}
        </div>

        {/* Footer: League Picker + Points */}
        <div className="sidebar-footer">
          {/* Points */}
          <div className="sidebar-points">
            <div className="sidebar-points-icon"><Icons.Coins size={18} /></div>
            <div className="sidebar-points-info">
              <div className="sidebar-points-label">Points</div>
              <div className="sidebar-points-value">{points.toLocaleString()}</div>
            </div>
          </div>

          {/* League */}
          <div className="league-picker-label">Active League</div>
          <div className="league-picker">
            {LEAGUES.map(lg => (
              <button
                key={lg.id}
                className={`league-btn ${leagueId === lg.id ? 'active' : ''}`}
                onClick={() => setLeagueId(lg.id)}
              >
                <img
                  src={`https://flagcdn.com/20x15/${lg.flagCode}.png`}
                  width="20" height="15" alt={lg.country}
                  style={{ borderRadius: 2, flexShrink: 0 }}
                />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, fontWeight: 600 }}>{lg.name}</div>
                  <div style={{ fontSize: 10, opacity: 0.6 }}>{lg.country}</div>
                </div>
                {leagueId === lg.id && <Icons.Check size={12} color="var(--green)" />}
              </button>
            ))}
          </div>
        </div>
      </nav>

      {/* ── Main Content ── */}
      <main className="main-content">
        <Routes>
          <Route path="/"          element={<Simulate    {...shared} />} />
          <Route path="/simulate"  element={<Simulate    {...shared} />} />
          <Route path="/groups"    element={<Groups      {...shared} />} />
          <Route path="/bracket"   element={<Bracket     {...shared} />} />
          <Route path="/teams"     element={<Teams       {...shared} />} />
          <Route path="/matches"   element={<Matches     {...shared} />} />
          <Route path="/betting"   element={<MatchesBetting {...shared} />} />
          <Route path="/transfer"  element={<TransferMinigame {...shared} />} />
        </Routes>
      </main>
    </div>
  )
}