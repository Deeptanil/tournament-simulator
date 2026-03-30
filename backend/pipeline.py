 
import requests
import pandas as pd
import os
from sqlalchemy import text
from database import engine
from dotenv import load_dotenv

load_dotenv()

API_KEY = os.getenv("API_KEY")
LEAGUES = ["39", "140", "135"]  # 39: Premier League, 140: La Liga, 135: Serie A
SEASONS = ["2022", "2023"]
HEADERS = {"x-apisports-key": API_KEY}
FIXTURE_URL = "https://v3.football.api-sports.io/fixtures"
TEAM_URL = "https://v3.football.api-sports.io/teams"


def fetch_data():
    all_fixtures = []
    all_teams = []
    for league_id in LEAGUES:
        for season in SEASONS:
            print(f"Fetching season {season} for league {league_id}...")
            params = {"league": league_id, "season": season}

            r = requests.get(FIXTURE_URL, headers=HEADERS, params=params)
            if r.status_code == 200 and r.json().get("response"):
                fixtures = r.json()["response"]
                for f in fixtures:
                    f["_season"] = int(season)
                    f["_league_id"] = int(league_id)
                all_fixtures.extend(fixtures)
                print(f"  {len(fixtures)} fixtures fetched")
            else:
                print(f"  ERROR fetching fixtures: {r.status_code} {r.text[:100]}")

            r = requests.get(TEAM_URL, headers=HEADERS, params=params)
            if r.status_code == 200 and r.json().get("response"):
                teams = r.json()["response"]
                for t in teams:
                    t["_league_id"] = int(league_id)
                all_teams.extend(teams)
                print(f"  {len(teams)} teams fetched")
            else:
                print(f"  ERROR fetching teams: {r.status_code}")

    return all_fixtures, all_teams


def build_matches_df(all_fixtures):
    rows = []
    for f in all_fixtures:
        hg = f["goals"]["home"]
        ag = f["goals"]["away"]
        if hg is None or ag is None:
            continue
        outcome = "Home Win" if hg > ag else ("Away Win" if hg < ag else "Draw")
        rows.append({
            "match_date": f["fixture"]["date"],
            "home_team": f["teams"]["home"]["name"],
            "away_team": f["teams"]["away"]["name"],
            "home_goals": hg,
            "away_goals": ag,
            "outcome": outcome,
            "season": f.get("_season", 0),
            "league_id": f.get("_league_id", 0)
        })
    df = pd.DataFrame(rows)
    df["match_date"] = pd.to_datetime(df["match_date"])
    return df.sort_values("match_date").reset_index(drop=True)


def build_teams_df(all_teams):
    rows = []
    for t in all_teams:
        rows.append({
            "team_id": t["team"]["id"],
            "team_name": t["team"]["name"],
            "country": t["team"]["country"],
            "founded": t["team"]["founded"],
            "venue_name": t["venue"]["name"],
            "venue_city": t["venue"]["city"],
            "venue_capacity": t["venue"]["capacity"],
            "league_id": t.get("_league_id", 0)
        })
    return pd.DataFrame(rows).drop_duplicates(subset=["team_id"])


def compute_elo(matches_df):
    DEFAULT_ELO = 1500
    K = 30
    all_teams = pd.concat([matches_df["home_team"], matches_df["away_team"]]).unique()
    elo = {t: DEFAULT_ELO for t in all_teams}

    def expected(a, b):
        return 1 / (1 + 10 ** ((b - a) / 400))

    for _, row in matches_df.iterrows():
        h, a = row["home_team"], row["away_team"]
        e_h = expected(elo[h], elo[a])
        e_a = expected(elo[a], elo[h])
        if row["outcome"] == "Home Win":
            s_h, s_a = 1, 0
        elif row["outcome"] == "Away Win":
            s_h, s_a = 0, 1
        else:
            s_h, s_a = 0.5, 0.5
        elo[h] += K * (s_h - e_h)
        elo[a] += K * (s_a - e_a)

    return elo


def push_to_db(matches_df, teams_df, elo_ratings):
    with engine.connect() as conn:
        conn.execute(text("DELETE FROM teams"))
        for _, row in teams_df.iterrows():
            conn.execute(text("""
                INSERT INTO teams (team_id, team_name, country, founded,
                                   venue_name, venue_city, venue_capacity, league_id)
                VALUES (:team_id, :team_name, :country, :founded,
                        :venue_name, :venue_city, :venue_capacity, :league_id)
                ON CONFLICT (team_id) DO NOTHING
            """), row.to_dict())

        conn.execute(text("DELETE FROM matches"))
        for _, row in matches_df.iterrows():
            conn.execute(text("""
                INSERT INTO matches (match_date, home_team, away_team,
                                     home_goals, away_goals, outcome, season, league_id)
                VALUES (:match_date, :home_team, :away_team,
                        :home_goals, :away_goals, :outcome, :season, :league_id)
            """), row.to_dict())

        conn.execute(text("DELETE FROM elo_ratings"))
        for team, rating in elo_ratings.items():
            conn.execute(text("""
                INSERT INTO elo_ratings (team_name, elo_rating)
                VALUES (:team_name, :elo_rating)
                ON CONFLICT (team_name) DO UPDATE SET elo_rating = EXCLUDED.elo_rating
            """), {"team_name": team, "elo_rating": rating})

        conn.commit()
    print("All data pushed to database.")


if __name__ == "__main__":
    print("=== Running pipeline ===")
    fixtures, teams_raw = fetch_data()
    matches_df = build_matches_df(fixtures)
    teams_df = build_teams_df(teams_raw)
    elo = compute_elo(matches_df)
    push_to_db(matches_df, teams_df, elo)

    print("\nFinal Elo ratings:")
    for team, rating in sorted(elo.items(), key=lambda x: -x[1]):
        print(f"  {team}: {rating:.1f}")