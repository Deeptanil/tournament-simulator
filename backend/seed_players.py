import os
import requests
from sqlalchemy import text
from database import engine
from dotenv import load_dotenv

load_dotenv()

RAPID_API_KEY = os.getenv("RAPIDAPI_KEY")

FALLBACK_PLAYERS = [
    {"player_id": 1, "name": "Kylian Mbappé", "team": "Real Madrid", "value": 180000000, "img": "https://media.api-sports.io/football/players/278.png"},
    {"player_id": 2, "name": "Erling Haaland", "team": "Manchester City", "value": 180000000, "img": "https://media.api-sports.io/football/players/1100.png"},
    {"player_id": 3, "name": "Jude Bellingham", "team": "Real Madrid", "value": 150000000, "img": "https://media.api-sports.io/football/players/132.png"},
    {"player_id": 4, "name": "Vinícius Júnior", "team": "Real Madrid", "value": 150000000, "img": "https://media.api-sports.io/football/players/739.png"},
    {"player_id": 5, "name": "Bukayo Saka", "team": "Arsenal", "value": 120000000, "img": "https://media.api-sports.io/football/players/1468.png"},
    {"player_id": 6, "name": "Phil Foden", "team": "Manchester City", "value": 110000000, "img": "https://media.api-sports.io/football/players/601.png"},
    {"player_id": 7, "name": "Jamal Musiala", "team": "Bayern Munich", "value": 110000000, "img": "https://media.api-sports.io/football/players/500.png"},
    {"player_id": 8, "name": "Lautaro Martínez", "team": "Inter", "value": 110000000, "img": "https://media.api-sports.io/football/players/1033.png"},
    {"player_id": 9, "name": "Victor Osimhen", "team": "Galatasaray", "value": 110000000, "img": "https://media.api-sports.io/football/players/202.png"},
    {"player_id": 10, "name": "Declan Rice", "team": "Arsenal", "value": 110000000, "img": "https://media.api-sports.io/football/players/144.png"},
    {"player_id": 11, "name": "Rodri", "team": "Manchester City", "value": 110000000, "img": "https://media.api-sports.io/football/players/162.png"},
    {"player_id": 12, "name": "Harry Kane", "team": "Bayern Munich", "value": 110000000, "img": "https://media.api-sports.io/football/players/184.png"},
    {"player_id": 13, "name": "Florian Wirtz", "team": "Bayer Leverkusen", "value": 100000000, "img": "https://media.api-sports.io/football/players/882.png"},
    {"player_id": 14, "name": "Rodrygo", "team": "Real Madrid", "value": 100000000, "img": "https://media.api-sports.io/football/players/740.png"},
    {"player_id": 15, "name": "Federico Valverde", "team": "Real Madrid", "value": 100000000, "img": "https://media.api-sports.io/football/players/738.png"}
]

def fetch_players():
    print("Attempting to fetch players from RapidAPI...")
    
    # We will try the search endpoint
    url = "https://free-api-live-football-data.p.rapidapi.com/football-players-search?search=m"
    headers = {
        "x-rapidapi-host": "free-api-live-football-data.p.rapidapi.com",
        "x-rapidapi-key": RAPID_API_KEY
    }
    
    fetched = False
    try:
        response = requests.get(url, headers=headers, timeout=5)
        if response.status_code == 200:
            data = response.json()
            # If the API returns valid data AND has market values, parse it here
            # Since we don't know the exact struct, we log it and fallback if needed
            print("API Success! Structure:", list(data.keys()) if isinstance(data, dict) else type(data))
            # Just fallback to curated list if we can't cleanly parse a market value right now 
            # (which is typical for basic rapidapi live football apis).
        else:
            print(f"API Failed with {response.status_code}. Using fallback data.")
    except Exception as e:
        print(f"API Request Error: {e}")
        
    print("Seeding database with players...")
    with engine.begin() as conn:
        conn.execute(text("DELETE FROM players"))
        for p in FALLBACK_PLAYERS:
            conn.execute(text("""
                INSERT INTO players (player_id, name, team_name, transfer_value, image_url)
                VALUES (:player_id, :name, :team, :value, :img)
            """), {"player_id": p["player_id"], "name": p["name"], "team": p["team"], "value": p["value"], "img": p["img"]})
            
    print("Database seeded with top players!")

if __name__ == "__main__":
    fetch_players()
