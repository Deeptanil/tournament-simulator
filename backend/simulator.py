import random
import math
from database import engine
from sqlalchemy import text

# ── Hard-coded league team lists ─────────────────────────────────────────────
# Used as fallback when DB has no league_id tagged rows.
# Assigned Elo values are realistic estimates. These serve as the "truth" when
# actual pipeline data is not available for La Liga / Serie A.
LEAGUE_TEAMS = {
    39: {  # Premier League
        "Manchester City":     1980, "Arsenal":          1820, "Liverpool":          1810,
        "Chelsea":             1750, "Tottenham":         1720, "Aston Villa":        1700,
        "Newcastle":           1690, "Manchester United": 1680, "Brighton":           1660,
        "West Ham":            1640, "Crystal Palace":    1620, "Brentford":          1600,
        "Fulham":              1590, "Wolves":            1570, "Everton":            1540,
        "Nottingham Forest":   1520,
    },
    140: {  # La Liga
        "Real Madrid":  1970, "Barcelona":       1880, "Atletico Madrid": 1820,
        "Real Sociedad":1730, "Real Betis":       1710, "Villarreal":      1700,
        "Athletic Bilbao":1690,"Girona":          1670, "Valencia":        1650,
        "Sevilla":      1640, "Osasuna":          1600, "Rayo Vallecano":  1580,
        "Getafe":       1560, "Celta Vigo":       1540, "Mallorca":        1530,
        "Cadiz":        1510,
    },
    135: {  # Serie A
        "Inter":      1900, "Juventus":    1830, "AC Milan":   1810,
        "Napoli":     1800, "Roma":        1760, "Lazio":      1740,
        "Atalanta":   1730, "Fiorentina":  1690, "Torino":     1650,
        "Bologna":    1640, "Monza":       1600, "Empoli":     1580,
        "Salernitana":1560, "Lecce":       1540, "Udinese":    1530,
        "Frosinone":  1510,
    },
}


def get_league_elo(league_id):
    """Return elo dict for a specific league.
    Merges DB elo_ratings with hard-coded estimates so league-specific
    teams always have a rating regardless of whether pipeline ran."""
    base_elo  = dict(LEAGUE_TEAMS.get(league_id, {}))

    # Overwrite with real DB data where it exists for these exact team names
    with engine.connect() as conn:
        rows = conn.execute(text(
            "SELECT team_name, elo_rating FROM elo_ratings"
        )).fetchall()
    for r in rows:
        if r[0] in base_elo:
            base_elo[r[0]] = r[1]  # prefer real computed Elo

    return base_elo


def load_elo():
    """Load ALL elo_ratings from DB (used by global/legacy simulation). """
    with engine.connect() as conn:
        rows = conn.execute(text("SELECT team_name, elo_rating FROM elo_ratings")).fetchall()
    return {r[0]: r[1] for r in rows}


def get_league_groups(league_id):
    """Return 4 groups of 4 for the given league.
    Tries DB league_id first, then falls back to LEAGUE_TEAMS."""
    with engine.connect() as conn:
        rows = conn.execute(text("""
            SELECT t.team_name, e.elo_rating
            FROM teams t
            JOIN elo_ratings e ON t.team_name = e.team_name
            WHERE t.league_id = :league_id
            ORDER BY e.elo_rating DESC LIMIT 16
        """), {"league_id": league_id}).fetchall()

    if len(rows) >= 16:
        teams = [r[0] for r in rows]
    else:
        # Use curated league team list, ordered by Elo estimate
        league_map = LEAGUE_TEAMS.get(league_id, LEAGUE_TEAMS[39])
        teams = sorted(league_map, key=lambda t: league_map[t], reverse=True)[:16]

    # Safety pad
    while len(teams) < 16:
        teams.append(teams[-1])

    return {
        "A": teams[0:4],   "B": teams[4:8],
        "C": teams[8:12],  "D": teams[12:16],
    }


def expected(elo_a, elo_b):
    return 1 / (1 + 10 ** ((elo_b - elo_a) / 400))


def sim_match(a, b, elo):
    ea = elo.get(a, 1500)
    eb = elo.get(b, 1500)
    p  = expected(ea, eb)
    # Draw zone
    if 0.38 <= p <= 0.62 and random.random() < 0.28:
        return None
    return a if random.random() < p else b


def sim_ko(a, b, elo):
    """Knockout match: compress Elo advantage — cup football is much more
    unpredictable. A heavy underdog still wins ~30% of the time."""
    ea = elo.get(a, 1500)
    eb = elo.get(b, 1500)
    p_base = expected(ea, eb)
    # Compress 55% toward 0.5 — upsets happen!
    p = 0.5 + (p_base - 0.5) * 0.45
    # Extra penalty time / randomness
    p += (random.random() - 0.5) * 0.05
    p = max(0.1, min(0.9, p))
    return a if random.random() < p else b


def sim_group(teams, elo):
    points = {t: 0 for t in teams}
    h2h    = {t: 0 for t in teams}
    for i in range(len(teams)):
        for j in range(i + 1, len(teams)):
            result = sim_match(teams[i], teams[j], elo)
            if result is None:
                points[teams[i]] += 1
                points[teams[j]] += 1
            else:
                points[result] += 3
                h2h[result]    += 1
    return sorted(teams, key=lambda t: (points[t], h2h[t]), reverse=True)


def sim_match_score(a, b, elo):
    ea = elo.get(a, 1500)
    eb = elo.get(b, 1500)
    p_a = expected(ea, eb)

    def poisson(lam):
        lam = max(lam, 0.1)
        L = math.exp(-lam)
        k, p = 0, 1.0
        while p > L:
            k += 1
            p *= random.random()
        return k - 1

    avg_goals = 2.7
    home_adv  = 1.12
    exp_a = p_a * avg_goals * home_adv
    exp_b = (1 - p_a) * avg_goals * (2 - home_adv)

    return {
        "home_team":  a, "away_team":  b,
        "home_goals": max(0, poisson(exp_a)),
        "away_goals": max(0, poisson(exp_b)),
        "home_elo": round(ea), "away_elo": round(eb),
    }


def run_simulation(n, elo, league_id=39):
    # Merge with league-specific elo so out-of-DB teams still work
    league_elo = get_league_elo(league_id)
    merged_elo  = {**elo, **league_elo}

    groups    = get_league_groups(league_id)
    all_teams = [t for g in groups.values() for t in g]
    qualify   = {t: 0 for t in all_teams}
    first     = {t: 0 for t in all_teams}
    second    = {t: 0 for t in all_teams}
    semis     = {t: 0 for t in all_teams}
    finals    = {t: 0 for t in all_teams}
    champions = {t: 0 for t in all_teams}

    for _ in range(n):
        gr = {}
        for gname, teams in groups.items():
            ranked = sim_group(teams, merged_elo)
            gr[gname] = {"1st": ranked[0], "2nd": ranked[1]}
            qualify[ranked[0]] += 1
            qualify[ranked[1]] += 1
            first[ranked[0]]   += 1
            second[ranked[1]]  += 1

        qf_winners = [
            sim_ko(gr["A"]["1st"], gr["B"]["2nd"], merged_elo),
            sim_ko(gr["C"]["1st"], gr["D"]["2nd"], merged_elo),
            sim_ko(gr["B"]["1st"], gr["A"]["2nd"], merged_elo),
            sim_ko(gr["D"]["1st"], gr["C"]["2nd"], merged_elo),
        ]
        for t in qf_winners:
            semis[t] += 1

        f1 = sim_ko(qf_winners[0], qf_winners[1], merged_elo)
        f2 = sim_ko(qf_winners[2], qf_winners[3], merged_elo)
        finals[f1] += 1
        finals[f2] += 1

        champ = sim_ko(f1, f2, merged_elo)
        champions[champ] += 1

    return {
        "qualify": qualify, "first": first,  "second": second,
        "semis":   semis,   "finals": finals, "champions": champions,
    }