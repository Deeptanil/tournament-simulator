"""
Consolidate, merge, and clean the world-class Transfermarkt dataset 
into the local Tournament Simulator database.
"""
import csv
import os
import re
from sqlalchemy import text
from database import engine

BASE_DIR = os.path.join(os.path.dirname(__file__), "..", "data", "datalake", "transfermarkt")

def normalize_team(name):
    if not name: return ""
    # 1. Remove "(ID)" suffix and trailing whitespace
    name = re.sub(r'\s*\(\d+\)$', '', name).strip()
    
    # 2. Common replacements for better matching (Major Teams)
    replacements = {
        r'\bMan City\b': 'Manchester City',
        r'\bMan Utd\b': 'Manchester United',
        r'\bSpurs\b': 'Tottenham Hotspur',
        r'\bBayern\b': 'Bayern Munich',
        r'\bJuve\b': 'Juventus',
        r'\bAtleti\b': 'Atletico Madrid',
        r'\bBarca\b': 'FC Barcelona',
        r'\bInternazionale\b': 'Inter Milan',
        r'\bMilan\b': 'AC Milan',
        r'\bReal\b': 'Real Madrid',
        r'\bParis Saint-Germain\b': 'PSG',
        r'\bParis SG\b': 'PSG',
        r'\bSporting CP\b': 'Sporting Lisbon',
    }
    for pattern, repl in replacements.items():
        name = re.sub(pattern, repl, name, flags=re.IGNORECASE)

    # 3. Comprehensive list of suffixes/prefixes to strip
    # Covering Spain (La Liga), Italy (Serie A), Germany (Bundesliga), France (Ligue 1)
    suffixes = [
        r'\bFC\b', r'\bCF\b', r'\bAFC\b', r'\bUD\b', r'\bAS\b', r'\bSC\b', r'\bCD\b', 
        r'\bRC\b', r'\bRCD\b', r'\bSSC\b', r'\bAC\b', r'\bSD\b', r'\bUS\b', r'\bSL\b', 
        r'\bB\b', r'\bVfL\b', r'\bVfB\b', r'\bFSV\b', r'\bEintracht\b', r'\bTSG\b',
        r'\b04\b', r'\b05\b', r'\b1904\b', r'\b1899\b', r'\bSaint-Germain\b', r'\bDeportivo\b'
    ]
    for suf in suffixes:
        name = re.sub(suf, '', name, flags=re.IGNORECASE).strip()
    
    # Remove extra spaces caused by stripping
    name = re.sub(r'\s+', ' ', name).strip()
    
    return name.lower()

def consolidate_db():
    print("--- Starting Full Data Consolidation & Enrichment ---")
    
    profiles_path = os.path.join(BASE_DIR, "player_profiles", "player_profiles.csv")
    values_path = os.path.join(BASE_DIR, "player_latest_market_value", "player_latest_market_value.csv")
    team_history_path = os.path.join(BASE_DIR, "team_competitions_seasons", "team_competitions_seasons.csv")
    
    if not os.path.exists(profiles_path) or not os.path.exists(values_path) or not os.path.exists(team_history_path):
        print("Error: Missing required CSV files in data/datalake/")
        return

    # 1. Aggregate Historical Team Stats
    print("Aggregating historical team stats (30+ years)...")
    team_stats = {} # {normalized_name: {wins, goals, rank_sum, rank_cnt, games}}
    with open(team_history_path, mode='r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            raw_name = row['team_name']
            norm_name = normalize_team(raw_name)
            try:
                wins  = int(row['season_wins'] or 0)
                goals = int(row['season_goals_for'] or 0)
                rank  = int(row['season_rank'] or 0)
                games = int(row['season_total_matches'] or 0)
                
                if norm_name not in team_stats:
                    team_stats[norm_name] = {'wins': 0, 'goals': 0, 'rank_sum': 0, 'rank_cnt': 0, 'games': 0}
                
                team_stats[norm_name]['wins'] += wins
                team_stats[norm_name]['goals'] += goals
                team_stats[norm_name]['games'] += games
                if rank > 0:
                    team_stats[norm_name]['rank_sum'] += rank
                    team_stats[norm_name]['rank_cnt'] += 1
            except ValueError:
                continue

    # 2. Merge Player Data
    print("Merging player market values and metadata...")
    market_values = {}
    with open(values_path, mode='r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            market_values[row['player_id']] = float(row['value'] or 0)

    print("Cleaning 93,000 player records...")
    player_pool = []
    with open(profiles_path, mode='r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            pid = row['player_id']
            val = market_values.get(pid, 0)
            img = row['player_image_url']
            
            # Smart filter: Only players with portraits and value > 10M
            if img and 'portrait' in img and val > 10000000:
                player_pool.append({
                    'pid': int(pid),
                    'name': re.sub(r'\s*\(\d+\)$', '', row['player_name']).strip(),
                    'team': re.sub(r'\s*\(\d+\)$', '', row['current_club_name']).strip(),
                    'value': val,
                    'img': img,
                    'height': int(float(row['height'] or 0)),
                    'foot': row['foot'] if row['foot'] != 'N/A' else 'Right',
                    'pos': row['position'],
                    'nat': row['citizenship']
                })
    
    # Sort by value
    player_pool.sort(key=lambda x: x['value'], reverse=True)
    top_players = player_pool[:2027] # Match the count from previous runs
    print(f"Pool ready: {len(top_players)} world-class players selected.")

    # 3. Apply to Database
    print("Applying changes to PostgreSQL database...")
    with engine.begin() as conn:
        # Update Team Metadata
        print("Enriching team historical dominance stats...")
        db_teams = conn.execute(text("SELECT team_name FROM teams")).fetchall()
        match_count = 0
        for (db_name,) in db_teams:
            norm_db_name = normalize_team(db_name)
            stats = team_stats.get(norm_db_name)
            if stats:
                match_count += 1
                avg_rank = stats['rank_sum'] / stats['rank_cnt'] if stats['rank_cnt'] > 0 else 0
                conn.execute(text("""
                    UPDATE teams SET 
                      total_wins = :wins,
                      total_goals = :goals,
                      matches_played = :games,
                      avg_rank = :rank
                    WHERE team_name = :name
                """), {"name": db_name, "wins": stats['wins'], "goals": stats['goals'], "games": stats['games'], "rank": avg_rank})
            else:
                # Clear potentially stale data for non-matches
                conn.execute(text("""
                    UPDATE teams SET total_wins = NULL, total_goals = NULL WHERE team_name = :name
                """), {"name": db_name})
        print(f"Stats Matched: {match_count} teams matched with historical data.")

        # Update Player Universe
        print("Deduplicating and populating worldwide player pool...")
        conn.execute(text("DELETE FROM players")) # Clear old simplified pool
        for p in top_players:
            conn.execute(text("""
                INSERT INTO players (player_id, name, team_name, transfer_value, image_url, height, foot, position, nationality)
                VALUES (:pid, :name, :team, :value, :img, :height, :foot, :pos, :nat)
            """), {"pid": p['pid'], "name": p['name'], "team": p['team'], "value": p['value'], 
                   "img": p['img'], "height": p['height'], "foot": str(p['foot']).title(), "pos": p['pos'], "nat": p['nat']})

    print("Success! Datalake consolidated and database cleaned.")

if __name__ == "__main__":
    consolidate_db()
