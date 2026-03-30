"""
Import historical football data from the datasets/football-datasets GitHub repo.
Downloads CSVs and inserts into the matches table with proper league_id tags.

Run: python import_football_data.py
"""
import io
import requests
import csv
from datetime import datetime
from sqlalchemy import text
from database import engine

# ── URL pattern ──────────────────────────────────────────────────────────────
BASE = "https://raw.githubusercontent.com/datasets/football-datasets/main/datasets"
LEAGUES = {
    39:  {"path": "premier-league", "seasons": ["2122", "2223", "2324"]},
    140: {"path": "la-liga",        "seasons": ["2122", "2223", "2324"]},
    135: {"path": "serie-a",        "seasons": ["2122", "2223", "2324"]},
}

# ── Team name normalisation ─────────────────────────────────────────────────
# Maps CSV short names → our canonical team names

NAME_MAP = {
    # Premier League
    "Man City":       "Manchester City",
    "Man United":     "Manchester United",
    "Nott'm Forest":  "Nottingham Forest",
    "Newcastle":      "Newcastle",
    "Wolves":         "Wolves",
    "Brighton":       "Brighton",
    "Crystal Palace": "Crystal Palace",
    "West Ham":       "West Ham",
    "Aston Villa":    "Aston Villa",
    "Tottenham":      "Tottenham",
    "Arsenal":        "Arsenal",
    "Liverpool":      "Liverpool",
    "Chelsea":        "Chelsea",
    "Everton":        "Everton",
    "Brentford":      "Brentford",
    "Fulham":         "Fulham",
    "Leicester":      "Leicester",
    "Leeds":          "Leeds",
    "Southampton":    "Southampton",
    "Bournemouth":    "Bournemouth",
    "Burnley":        "Burnley",
    "Sheffield United": "Sheffield United",
    "Luton":          "Luton",
    # La Liga
    "Ath Bilbao":     "Athletic Bilbao",
    "Ath Madrid":     "Atletico Madrid",
    "Sociedad":       "Real Sociedad",
    "Betis":          "Real Betis",
    "Vallecano":      "Rayo Vallecano",
    "Espanol":        "Espanol",
    "Valladolid":     "Valladolid",
    "Almeria":        "Almeria",
    "Elche":          "Elche",
    "Girona":         "Girona",
    "Osasuna":        "Osasuna",
    "Sevilla":        "Sevilla",
    "Real Madrid":    "Real Madrid",
    "Barcelona":      "Barcelona",
    "Villarreal":     "Villarreal",
    "Celta":          "Celta Vigo",
    "Getafe":         "Getafe",
    "Valencia":       "Valencia",
    "Mallorca":       "Mallorca",
    "Cadiz":          "Cadiz",
    "Alaves":         "Alaves",
    "Las Palmas":     "Las Palmas",
    "Granada":        "Granada",
    # Serie A
    "Inter":          "Inter",
    "Juventus":       "Juventus",
    "Milan":          "AC Milan",
    "AC Milan":       "AC Milan",
    "Napoli":         "Napoli",
    "Roma":           "Roma",
    "Lazio":          "Lazio",
    "Atalanta":       "Atalanta",
    "Fiorentina":     "Fiorentina",
    "Torino":         "Torino",
    "Bologna":        "Bologna",
    "Monza":          "Monza",
    "Empoli":         "Empoli",
    "Salernitana":    "Salernitana",
    "Lecce":          "Lecce",
    "Udinese":        "Udinese",
    "Frosinone":      "Frosinone",
    "Verona":         "Verona",
    "Sassuolo":       "Sassuolo",
    "Hellas Verona":  "Verona",
    "Cremonese":      "Cremonese",
    "Spezia":         "Spezia",
    "Sampdoria":      "Sampdoria",
    "Cagliari":       "Cagliari",
    "Genoa":          "Genoa",
}

def normalize(name):
    return NAME_MAP.get(name.strip(), name.strip())

def season_year(code):
    """Convert '2223' → 2022"""
    return 2000 + int(code[:2])

def parse_date(s):
    for fmt in ("%d/%m/%y", "%d/%m/%Y", "%Y-%m-%d"):
        try:
            return datetime.strptime(s.strip(), fmt).date()
        except ValueError:
            continue
    return None

def outcome_from_ftr(ftr):
    return {"H": "Home Win", "A": "Away Win", "D": "Draw"}.get(ftr.strip(), "Draw")


def import_league(league_id, league_cfg):
    total = 0
    for season_code in league_cfg["seasons"]:
        url = f"{BASE}/{league_cfg['path']}/season-{season_code}.csv"
        print(f"  Downloading {url}…", end=" ")
        try:
            resp = requests.get(url, timeout=15)
            if resp.status_code != 200:
                print(f"SKIP (HTTP {resp.status_code})")
                continue
        except Exception as e:
            print(f"SKIP (error: {e})")
            continue

        season_yr = season_year(season_code)
        rows_inserted = 0
        reader = csv.DictReader(io.StringIO(resp.text))

        with engine.begin() as conn:
            for row in reader:
                try:
                    home  = normalize(row.get("HomeTeam", "").strip())
                    away  = normalize(row.get("AwayTeam", "").strip())
                    hg    = int(row.get("FTHG", 0) or 0)
                    ag    = int(row.get("FTAG", 0) or 0)
                    ftr   = row.get("FTR", "D")
                    date  = parse_date(row.get("Date", ""))
                    if not home or not away or not date:
                        continue
                    conn.execute(text("""
                        INSERT INTO matches
                            (match_date, home_team, away_team, home_goals, away_goals,
                             outcome, season, league_id)
                        VALUES (:d,:h,:a,:hg,:ag,:o,:s,:lid)
                    """), {"d": date, "h": home, "a": away, "hg": hg, "ag": ag,
                           "o": outcome_from_ftr(ftr), "s": season_yr, "lid": league_id})
                    rows_inserted += 1
                except Exception:
                    continue
        print(f"OK ({rows_inserted} rows)")
        total += rows_inserted
    return total


def run():
    print("Clearing old matches …")
    with engine.begin() as conn:
        conn.execute(text("DELETE FROM matches"))

    grand_total = 0
    for lid, cfg in LEAGUES.items():
        print(f"\nLeague {lid} ({cfg['path']}):")
        grand_total += import_league(lid, cfg)

    print(f"\nDone! {grand_total} total matches imported.")

if __name__ == "__main__":
    run()
