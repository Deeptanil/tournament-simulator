"""
Bulk-import ALL historical football data from local CSV files.
Covers 5 leagues × ~32 seasons each ≈ 17,000+ matches (1993–2026).

Run: python import_all_data.py

Requires: data/ folder (moved from football-datasets-main/) at project root,
i.e. ../../data/datasets/premier-league/season-*.csv
"""
import csv
import glob
import os
import re
from datetime import datetime
from sqlalchemy import text
from database import engine

# ── League config ────────────────────────────────────────────────────────────
# Data folder is two levels up from backend/
DATA_ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'data', 'datasets')

LEAGUES = {
    39:  'premier-league',
    140: 'la-liga',
    135: 'serie-a',
    78:  'bundesliga',
    61:  'ligue-1',
}

# ── Comprehensive team name normalisation ─────────────────────────────────────
# Covers historic names from 1993 onward for all 5 leagues
NAME_MAP = {
    # ── Premier League ──────────────────────────────────────────────────────
    "Man City":        "Manchester City",
    "Man United":      "Manchester United",
    "Nott'm Forest":   "Nottingham Forest",
    "Newcastle":       "Newcastle",
    "Wolves":          "Wolves",
    "Brighton":        "Brighton",
    "Crystal Palace":  "Crystal Palace",
    "West Ham":        "West Ham",
    "Aston Villa":     "Aston Villa",
    "Tottenham":       "Tottenham",
    "Arsenal":         "Arsenal",
    "Liverpool":       "Liverpool",
    "Chelsea":         "Chelsea",
    "Everton":         "Everton",
    "Brentford":       "Brentford",
    "Fulham":          "Fulham",
    "Leicester":       "Leicester",
    "Leeds":           "Leeds",
    "Southampton":     "Southampton",
    "Bournemouth":     "Bournemouth",
    "Burnley":         "Burnley",
    "Sheffield United":"Sheffield United",
    "Luton":           "Luton",
    "Ipswich":         "Ipswich",
    "Sunderland":      "Sunderland",
    "Stoke":           "Stoke City",
    "Stoke City":      "Stoke City",
    "Wigan":           "Wigan Athletic",
    "Swansea":         "Swansea City",
    "Hull":            "Hull City",
    "Blackburn":       "Blackburn",
    "Bolton":          "Bolton",
    "Charlton":        "Charlton",
    "Middlesbrough":   "Middlesbrough",
    "QPR":             "QPR",
    "Watford":         "Watford",
    "Norwich":         "Norwich",
    "West Brom":       "West Brom",
    "Derby":           "Derby",
    "Coventry":        "Coventry",
    "Sheffield Weds":  "Sheffield Wednesday",
    "Wimbledon":       "Wimbledon",
    "Oldham":          "Oldham Athletic",
    "Ipswich Town":    "Ipswich",
    "Portsmouth":      "Portsmouth",
    "Reading":         "Reading",
    "Blackpool":       "Blackpool",
    "Bradford":        "Bradford City",
    "Nottm Forest":    "Nottingham Forest",
    # ── La Liga ─────────────────────────────────────────────────────────────
    "Ath Bilbao":      "Athletic Bilbao",
    "Ath Madrid":      "Atletico Madrid",
    "Sociedad":        "Real Sociedad",
    "Betis":           "Real Betis",
    "Vallecano":       "Rayo Vallecano",
    "Espanol":         "Espanol",
    "Valladolid":      "Valladolid",
    "Almeria":         "Almeria",
    "Elche":           "Elche",
    "Girona":          "Girona",
    "Osasuna":         "Osasuna",
    "Sevilla":         "Sevilla",
    "Real Madrid":     "Real Madrid",
    "Barcelona":       "Barcelona",
    "Villarreal":      "Villarreal",
    "Celta":           "Celta Vigo",
    "Getafe":          "Getafe",
    "Valencia":        "Valencia",
    "Mallorca":        "Mallorca",
    "Cadiz":           "Cadiz",
    "Alaves":          "Alaves",
    "Las Palmas":      "Las Palmas",
    "Granada":         "Granada",
    "Tenerife":        "Tenerife",
    "Deportivo":       "Deportivo",
    "Numancia":        "Numancia",
    "Recreativo":      "Recreativo",
    "Racing Santander":"Racing Santander",
    "Malaga":          "Malaga",
    "Xerez":           "Xerez",
    "Sp Gijon":        "Sporting Gijon",
    "Hercules":        "Hercules",
    "Levante":         "Levante",
    "Zaragoza":        "Zaragoza",
    "Murcia":          "Murcia",
    "Albacete":        "Albacete",
    "Lerida":          "Lerida",
    "Real Burgos":     "Real Burgos",
    # ── Serie A ─────────────────────────────────────────────────────────────
    "Inter":           "Inter",
    "Juventus":        "Juventus",
    "Milan":           "AC Milan",
    "AC Milan":        "AC Milan",
    "Napoli":          "Napoli",
    "Roma":            "Roma",
    "Lazio":           "Lazio",
    "Atalanta":        "Atalanta",
    "Fiorentina":      "Fiorentina",
    "Torino":          "Torino",
    "Bologna":         "Bologna",
    "Monza":           "Monza",
    "Empoli":          "Empoli",
    "Salernitana":     "Salernitana",
    "Lecce":           "Lecce",
    "Udinese":         "Udinese",
    "Frosinone":       "Frosinone",
    "Verona":          "Verona",
    "Sassuolo":        "Sassuolo",
    "Hellas Verona":   "Verona",
    "Cremonese":       "Cremonese",
    "Spezia":          "Spezia",
    "Sampdoria":       "Sampdoria",
    "Cagliari":        "Cagliari",
    "Genoa":           "Genoa",
    "Parma":           "Parma",
    "Bari":            "Bari",
    "Foggia":          "Foggia",
    "Ancona":          "Ancona",
    "Reggiana":        "Reggiana",
    "Vicenza":         "Vicenza",
    "Perugia":         "Perugia",
    "Venezia":         "Venezia",
    "Brescia":         "Brescia",
    "Piacenza":        "Piacenza",
    "Livorno":         "Livorno",
    "Lecco":           "Lecco",
    "Palermo":         "Palermo",
    "Siena":           "Siena",
    "Catania":         "Catania",
    "Reggina":         "Reggina",
    "Chievo":          "Chievo",
    "Novara":          "Novara",
    "Pescara":         "Pescara",
    "Crotone":         "Crotone",
    "Benevento":       "Benevento",
    "SPAL":            "SPAL",
    # ── Bundesliga ──────────────────────────────────────────────────────────
    "Bayern Munich":   "Bayern Munich",
    "Dortmund":        "Borussia Dortmund",
    "Leverkusen":      "Bayer Leverkusen",
    "RB Leipzig":      "RB Leipzig",
    "Ein Frankfurt":   "Eintracht Frankfurt",
    "M'Gladbach":      "Borussia M'gladbach",
    "Wolves":          "Wolves",  # irrelevant in BL context
    "Wolfsburg":       "Wolfsburg",
    "Stuttgart":       "Stuttgart",
    "Schalke 04":      "Schalke 04",
    "Bremen":          "Werder Bremen",
    "Werder Bremen":   "Werder Bremen",
    "Hamburg":         "Hamburg",
    "Hertha":          "Hertha Berlin",
    "Hoffenheim":      "Hoffenheim",
    "Augsburg":        "Augsburg",
    "Union Berlin":    "Union Berlin",
    "Freiburg":        "Freiburg",
    "Mainz":           "Mainz",
    "FC Koln":         "FC Cologne",
    "Karlsruhe":       "Karlsruhe",
    "Kaiserslautern":  "Kaiserslautern",
    "Nurnberg":        "Nurnberg",
    "Dresden":         "Dresden",
    "Leipzig":         "RB Leipzig",
    "Duisburg":        "Duisburg",
    "Wattenscheid":    "Wattenscheid",
    "Hansa Rostock":   "Hansa Rostock",
    "Bochum":          "Bochum",
    "FC Saarbrucken":  "FC Saarbrucken",
    "Bielefeld":       "Bielefeld",
    "Paderborn":       "Paderborn",
    "Dusseldorf":      "Dusseldorf",
    "Greuther Furth":  "Greuther Furth",
    "Sandhausen":      "Sandhausen",
    "Heidenheim":      "Heidenheim",
    "Darmstadt":       "Darmstadt",
    # ── Ligue 1 ─────────────────────────────────────────────────────────────
    "Paris SG":        "PSG",
    "PSG":             "PSG",
    "Monaco":          "Monaco",
    "Lyon":            "Lyon",
    "Marseille":       "Marseille",
    "Lille":           "Lille",
    "Rennes":          "Rennes",
    "Nice":            "Nice",
    "Lens":            "Lens",
    "Nantes":          "Nantes",
    "Montpellier":     "Montpellier",
    "Strasbourg":      "Strasbourg",
    "Reims":           "Reims",
    "Toulouse":        "Toulouse",
    "Bordeaux":        "Bordeaux",
    "Auxerre":         "Auxerre",
    "Metz":            "Metz",
    "St Etienne":      "St Etienne",
    "Angers":          "Angers",
    "Brest":           "Brest",
    "Lorient":         "Lorient",
    "Troyes":          "Troyes",
    "Caen":            "Caen",
    "Nancy":           "Nancy",
    "Le Havre":        "Le Havre",
    "Bastia":          "Bastia",
    "Sochaux":         "Sochaux",
    "Guingamp":        "Guingamp",
    "Valenciennes":    "Valenciennes",
    "Ajaccio":         "Ajaccio",
    "Evian Thonon":    "Evian",
    "Martigues":       "Martigues",
    "Cannes":          "Cannes",
    "Sedan":           "Sedan",
    "Grenoble":        "Grenoble",
    "Arles":           "Arles",
    "Dijon":           "Dijon",
    "GFC Ajaccio":     "Ajaccio",
    "Stade Brestois":  "Brest",
    "Amiens":          "Amiens",
    "Nimes":           "Nimes",
    "Clermont":        "Clermont",
    "Montpelier":      "Montpellier",
}

def normalize(name: str) -> str:
    s = name.strip()
    return NAME_MAP.get(s, s)

def parse_date(s: str):
    for fmt in ("%d/%m/%y", "%d/%m/%Y", "%Y-%m-%d"):
        try:
            return datetime.strptime(s.strip(), fmt).date()
        except ValueError:
            continue
    return None

def outcome_from_ftr(ftr: str) -> str:
    return {"H": "Home Win", "A": "Away Win", "D": "Draw"}.get(ftr.strip(), "Draw")

def season_year_from_filename(fname: str) -> int:
    """
    season-9394.csv → 1993
    season-0001.csv → 2000
    season-2324.csv → 2023
    """
    m = re.search(r'season-(\d{2})(\d{2})\.csv', fname)
    if not m:
        return 2000
    yy = int(m.group(1))
    return (1900 + yy) if yy >= 93 else (2000 + yy)

# ── Elo calculation from match history ───────────────────────────────────────
K = 32
BASE_ELO = 1500.0

def expected(ra, rb):
    return 1 / (1 + 10 ** ((rb - ra) / 400))

def update_elo(elo_map, home, away, ftr):
    rh = elo_map.get(home, BASE_ELO)
    ra = elo_map.get(away, BASE_ELO)
    eh = expected(rh, ra)
    if ftr == "H":
        sh, sa = 1.0, 0.0
    elif ftr == "A":
        sh, sa = 0.0, 1.0
    else:
        sh = sa = 0.5
    elo_map[home] = rh + K * (sh - eh)
    elo_map[away] = ra + K * (sa - (1 - eh))


def run():
    print("=== Football Data Bulk Importer ===")
    print(f"Data root: {os.path.abspath(DATA_ROOT)}\n")

    if not os.path.isdir(DATA_ROOT):
        print("ERROR: data/datasets directory not found.")
        print("Make sure the 'data' folder is at the project root.")
        return

    # Clear old matches and elo
    print("Clearing existing matches and elo_ratings…")
    with engine.begin() as conn:
        conn.execute(text("DELETE FROM qualification_results"))
        conn.execute(text("DELETE FROM championship_results"))
        conn.execute(text("DELETE FROM simulation_runs"))
        conn.execute(text("DELETE FROM matches"))
        conn.execute(text("DELETE FROM elo_ratings"))

    elo_map: dict[str, float] = {}  # Global elo across all leagues
    grand_total = 0

    # Process leagues in chronological order (all seasons sorted)
    # Collect all files first
    all_files: list[tuple[int, int, str, int]] = []  # (season_year, league_id, filepath)
    for lid, folder in LEAGUES.items():
        league_path = os.path.join(DATA_ROOT, folder)
        if not os.path.isdir(league_path):
            print(f"  WARNING: {league_path} not found, skipping.")
            continue
        for fpath in glob.glob(os.path.join(league_path, 'season-*.csv')):
            fname = os.path.basename(fpath)
            sy = season_year_from_filename(fname)
            all_files.append((sy, lid, fpath, lid))

    # Sort by season year so Elo is computed chronologically
    all_files.sort(key=lambda x: x[0])

    print(f"Found {len(all_files)} season files across {len(LEAGUES)} leagues.\n")

    # Process each file
    for sy, lid, fpath, _ in all_files:
        fname = os.path.basename(fpath)
        rows = []
        elo_updates = []
        try:
            with open(fpath, encoding='utf-8', errors='replace') as f:
                reader = csv.DictReader(f)
                for row in reader:
                    try:
                        home_raw = row.get("HomeTeam", "").strip()
                        away_raw = row.get("AwayTeam", "").strip()
                        ftr      = row.get("FTR", "").strip()
                        home     = normalize(home_raw)
                        away     = normalize(away_raw)
                        if not home or not away or ftr not in ("H", "A", "D"):
                            continue
                        hg   = int(row.get("FTHG", 0) or 0)
                        ag   = int(row.get("FTAG", 0) or 0)
                        date = parse_date(row.get("Date", ""))
                        if not date:
                            continue
                        rows.append((date, home, away, hg, ag, outcome_from_ftr(ftr), sy, lid))
                        elo_updates.append((home, away, ftr))
                    except Exception:
                        continue
        except Exception as e:
            print(f"  SKIP {fname}: {e}")
            continue

        if not rows:
            continue

        # Update Elo
        for home, away, ftr in elo_updates:
            update_elo(elo_map, home, away, ftr)

        # Insert matches
        with engine.begin() as conn:
            conn.execute(text("""
                INSERT INTO matches
                    (match_date, home_team, away_team, home_goals, away_goals,
                     outcome, season, league_id)
                VALUES (:d,:h,:a,:hg,:ag,:o,:s,:lid)
            """), [
                {"d": r[0], "h": r[1], "a": r[2], "hg": r[3], "ag": r[4],
                 "o": r[5], "s": r[6], "lid": r[7]}
                for r in rows
            ])
        grand_total += len(rows)
        league_names = {39:"EPL",140:"LaLiga",135:"SerieA",78:"BL",61:"L1"}
        print(f"  [{league_names.get(lid,lid)}] {fname} → {len(rows)} rows")

    print(f"\nTotal matches imported: {grand_total}")

    # Save computed Elo to DB
    print(f"\nSaving {len(elo_map)} team Elo ratings…")
    with engine.begin() as conn:
        for team, elo in elo_map.items():
            conn.execute(text("""
                INSERT INTO elo_ratings (team_name, elo_rating)
                VALUES (:t, :e)
                ON CONFLICT (team_name) DO UPDATE SET elo_rating = EXCLUDED.elo_rating
            """), {"t": team, "e": round(elo, 2)})

    print("Done! All-time Elo ratings computed from full match history.")
    print(f"\n=== Summary ===")
    print(f"Matches:   {grand_total:,}")
    print(f"Teams w/ Elo: {len(elo_map):,}")


if __name__ == "__main__":
    run()
