from sqlalchemy import create_engine, text
from dotenv import load_dotenv
import os

load_dotenv()

engine = create_engine(os.getenv("DATABASE_URL"))

def init_db():
    with engine.connect() as conn:
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS teams (
                id SERIAL PRIMARY KEY,
                team_id INTEGER UNIQUE,
                team_name VARCHAR(100) UNIQUE NOT NULL,
                country VARCHAR(50),
                founded INTEGER,
                venue_name VARCHAR(100),
                venue_city VARCHAR(100),
                venue_capacity INTEGER,
                league_id INTEGER
            )
        """))
        # Using a try-except or just executing ALTER to safely migrate existing table
        try:
            conn.execute(text("ALTER TABLE teams ADD COLUMN league_id INTEGER"))
        except Exception:
            conn.rollback() # If column already exists, transaction aborts, we rollback and continue
        else:
            conn.commit()

        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS matches (
                id SERIAL PRIMARY KEY,
                match_date TIMESTAMPTZ,
                home_team VARCHAR(100),
                away_team VARCHAR(100),
                home_goals INTEGER,
                away_goals INTEGER,
                outcome VARCHAR(20),
                season INTEGER,
                league_id INTEGER
            )
        """))
        try:
            conn.execute(text("ALTER TABLE matches ADD COLUMN league_id INTEGER"))
        except Exception:
            conn.rollback()
        else:
            conn.commit()

        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS elo_ratings (
                id SERIAL PRIMARY KEY,
                team_name VARCHAR(100) UNIQUE NOT NULL,
                elo_rating FLOAT NOT NULL
            )
        """))
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS simulation_runs (
                id SERIAL PRIMARY KEY,
                run_timestamp TIMESTAMP DEFAULT NOW(),
                n_iterations INTEGER,
                status VARCHAR(20)
            )
        """))
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS qualification_results (
                id SERIAL PRIMARY KEY,
                simulation_run_id INTEGER REFERENCES simulation_runs(id),
                team_name VARCHAR(100),
                qualified_count INTEGER,
                finished_first_count INTEGER,
                finished_second_count INTEGER
            )
        """))
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS championship_results (
                id SERIAL PRIMARY KEY,
                simulation_run_id INTEGER REFERENCES simulation_runs(id),
                team_name VARCHAR(100),
                champion_count INTEGER,
                finalist_count INTEGER,
                semifinal_count INTEGER
            )
        """))
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS players (
                id SERIAL PRIMARY KEY,
                player_id INTEGER UNIQUE,
                name VARCHAR(150) NOT NULL,
                team_name VARCHAR(100),
                transfer_value FLOAT,
                image_url VARCHAR(255)
            )
        """))
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS high_scores (
                id SERIAL PRIMARY KEY,
                game_type VARCHAR(30) NOT NULL,
                score INTEGER NOT NULL,
                created_at TIMESTAMP DEFAULT NOW()
            )
        """))
        conn.commit()
    print("All tables created successfully.")

if __name__ == "__main__":
    init_db() 
