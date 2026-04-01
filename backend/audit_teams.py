import csv
import os
import re
from sqlalchemy import text
from database import engine

BASE_DIR = os.path.join(os.path.dirname(__file__), "..", "data", "datalake", "transfermarkt")

def normalize_team(name):
    if not name: return ""
    name = re.sub(r'\s*\(\d+\)$', '', name).strip()
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
    }
    for pattern, repl in replacements.items():
        name = re.sub(pattern, repl, name, flags=re.IGNORECASE)
    suffixes = [
        r'\bFC\b', r'\bCF\b', r'\bAFC\b', r'\bUD\b', r'\bAS\b', r'\bSC\b', r'\bCD\b', 
        r'\bRC\b', r'\bRCD\b', r'\bSSC\b', r'\bAC\b', r'\bSD\b', r'\bUS\b', r'\bSL\b', 
        r'\bVfL\b', r'\bVfB\b', r'\bFSV\b', r'\bEintracht\b', r'\bTSG\b', r'\b04\b', 
        r'\b05\b', r'\bDeportivo\b', r'\bReal\b'
    ]
    for suf in suffixes:
        name = re.sub(suf, '', name, flags=re.IGNORECASE).strip()
    return re.sub(r'\s+', ' ', name).strip().lower()

def audit():
    print("--- Database Teams ---")
    with engine.connect() as conn:
        db_teams = [row[0] for row in conn.execute(text("SELECT team_name FROM teams")).fetchall()]
        db_norm = {normalize_team(t): t for t in db_teams}
    
    csv_path = os.path.join(BASE_DIR, "team_competitions_seasons", "team_competitions_seasons.csv")
    csv_teams = set()
    if os.path.exists(csv_path):
        with open(csv_path, mode='r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row in reader:
                csv_teams.add(row['team_name'])
    
    matches = 0
    mismatches = []
    
    print(f"Total DB Teams: {len(db_teams)}")
    print(f"Total Unique CSV Teams: {len(csv_teams)}")
    
    for ct in csv_teams:
        nct = normalize_team(ct)
        if nct in db_norm:
            matches += 1
        else:
            if any(nct in normalize_team(dbt) for dbt in db_teams):
                mismatches.append(f"CSV: {ct} | Norm: {nct}")

    print(f"Matches: {matches}")
    print("Top 20 Unmatched CSV samples:")
    for m in list(csv_teams)[:20]:
        print(f"  {m} -> {normalize_team(m)}")
    
    print("\nSample DB Teams:")
    for d in db_teams[:20]:
        print(f"  {d} -> {normalize_team(d)}")

if __name__ == "__main__":
    audit()
