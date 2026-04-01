import psycopg2
import os
from dotenv import load_dotenv

load_dotenv()
url = os.getenv("DATABASE_URL")

try:
    conn = psycopg2.connect(url)
    cur = conn.cursor()
    
    print("--- Players Columns ---")
    cur.execute("SELECT column_name FROM information_schema.columns WHERE table_name = 'players'")
    for col in cur.fetchall(): print(col[0])
    
    print("\n--- Teams Columns ---")
    cur.execute("SELECT column_name FROM information_schema.columns WHERE table_name = 'teams'")
    for col in cur.fetchall(): print(col[0])
    
    print("\n--- Counts ---")
    cur.execute("SELECT COUNT(*) FROM players")
    print("Player Count:", cur.fetchone()[0])
    
    cur.execute("SELECT COUNT(*) FROM teams WHERE total_wins > 0")
    print("Teams with wins:", cur.fetchone()[0])
    
    cur.close()
    conn.close()
except Exception as e:
    print("Error:", e)
