"""
Merge official Transfermarkt data from football-datasets-main/datalake/transfermarkt/
into the local Tournament Simulator database using built-in csv module.
"""
import csv
import os
import re
from sqlalchemy import text
from database import engine

BASE_DIR = os.path.join(os.path.dirname(__file__), "..", "football-datasets-main", "datalake", "transfermarkt")

def clean_name(name):
    if not name: return ""
    # Remove things like "Mbappé (123)"
    name = re.sub(r'\s*\(\d+\)$', '', name).strip()
    # Handle weird encoding if any
    return name

def seed_external():
    print("--- Starting External Data Merge (Transfermarkt) ---")
    
    profiles_path = os.path.join(BASE_DIR, "player_profiles", "player_profiles.csv")
    values_path = os.path.join(BASE_DIR, "player_latest_market_value", "player_latest_market_value.csv")
    teams_path = os.path.join(BASE_DIR, "team_details", "team_details.csv")
    
    if not os.path.exists(profiles_path) or not os.path.exists(values_path):
        print(f"Error: Missing CSV files in {BASE_DIR}")
        return

    # 1. Load Market Values into a dictionary {player_id: value}
    print("Loading market values...")
    market_values = {}
    with open(values_path, mode='r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            pid = row['player_id']
            val = float(row['value'] or 0)
            market_values[pid] = val

    # 2. Process Player Profiles and prepare pool
    print("Processing player profiles...")
    player_pool = []
    with open(profiles_path, mode='r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            pid = row['player_id']
            val = market_values.get(pid, 0)
            img = row['player_image_url']
            
            # Filter criteria: Has portrait, value > 10M
            if img and 'portrait' in img and val > 10000000:
                player_pool.append({
                    'pid': int(pid),
                    'name': clean_name(row['player_name']),
                    'team': clean_name(row['current_club_name']),
                    'value': val,
                    'img': img
                })

    # Sort by value and take top 400
    player_pool.sort(key=lambda x: x['value'], reverse=True)
    top_players = player_pool[:400]
    print(f"Selected {len(top_players)} top global players (Min value: {top_players[-1]['value'] if top_players else 0})")

    # 3. Enrich Teams (Logos)
    print("Syncing team logos...")
    team_logos = {}
    if os.path.exists(teams_path):
        with open(teams_path, mode='r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row in reader:
                name = clean_name(row['club_name'])
                logo = row['logo_url']
                if logo:
                    team_logos[name.lower()] = logo

    # Start Database Update
    with engine.begin() as conn:
        # Update existing teams with logos if matched
        db_teams = conn.execute(text("SELECT team_name FROM teams")).fetchall()
        for (db_name,) in db_teams:
            match_logo = team_logos.get(db_name.lower())
            if match_logo:
                # We update the logo_url if we decide to add it, but for now we focus on metadata
                # Since we use team_ids.py for logos, this is a fallback
                pass

        # Populate Players table (Refresh)
        print("Updating players table...")
        conn.execute(text("DELETE FROM players")) # Refresh pool
        for p in top_players:
            conn.execute(text("""
                INSERT INTO players (player_id, name, team_name, transfer_value, image_url)
                VALUES (:pid, :name, :team, :value, :img)
            """), {"pid": p['pid'], "name": p['name'], "team": p['team'], "value": p['value'], "img": p['img']})

    print("Success! Database enriched with official Transfermarkt data.")

if __name__ == "__main__":
    seed_external()
