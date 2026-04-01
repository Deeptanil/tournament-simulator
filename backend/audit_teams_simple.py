from database import engine
from sqlalchemy import text

def audit():
    with engine.connect() as conn:
        print("LID 140 (La Liga) Teams:")
        r = conn.execute(text("SELECT team_name FROM teams WHERE league_id = 140 LIMIT 15")).fetchall()
        for x in r:
            print(f" - {x[0]}")
        
        print("\nLID 39 (Premier League) Teams:")
        r = conn.execute(text("SELECT team_name FROM teams WHERE league_id = 39 LIMIT 15")).fetchall()
        for x in r:
            print(f" - {x[0]}")

if __name__ == "__main__":
    audit()
