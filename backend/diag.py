import sqlite3
import os

db_path = "tournament.db" # Check standard path
if not os.path.exists(db_path):
    print(f"Error: {db_path} not found in {os.getcwd()}")
else:
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    print("--- Players Schema ---")
    cursor.execute("PRAGMA table_info(players)")
    for col in cursor.fetchall(): print(col)
    
    print("\n--- Teams Schema ---")
    cursor.execute("PRAGMA table_info(teams)")
    for col in cursor.fetchall(): print(col)
    
    print("\n--- Data Samples ---")
    cursor.execute("SELECT COUNT(*) FROM players")
    print("Player Count:", cursor.fetchone()[0])
    
    cursor.execute("SELECT COUNT(*) FROM teams WHERE total_wins > 0")
    print("Teams with wins:", cursor.fetchone()[0])
    
    conn.close()
