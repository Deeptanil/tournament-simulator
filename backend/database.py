from sqlalchemy import create_engine, text
from dotenv import load_dotenv
import os

load_dotenv()

engine = create_engine(os.getenv("DATABASE_URL"))

def add_column_if_not_exists(conn, table, column, col_type):
    """Safely adds a column to a table if it doesn't already exist."""
    check_sql = text(f"""
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = :table AND column_name = :column
    """)
    res = conn.execute(check_sql, {"table": table, "column": column}).fetchone()
    if not res:
        print(f"Adding column {column} to {table}...")
        conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {column} {col_type}"))
        return True
    return False

def init_db():
    # Use engine.begin() for automatic transaction management (commit on success)
    with engine.begin() as conn:
        # 1. Teams Table
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
        
        # Safe migrations for Teams
        add_column_if_not_exists(conn, "teams", "league_id",      "INTEGER")
        add_column_if_not_exists(conn, "teams", "total_wins",     "INTEGER DEFAULT 0")
        add_column_if_not_exists(conn, "teams", "total_goals",    "INTEGER DEFAULT 0")
        add_column_if_not_exists(conn, "teams", "avg_rank",       "FLOAT DEFAULT 0.0")
        add_column_if_not_exists(conn, "teams", "matches_played", "INTEGER DEFAULT 0")

        # 2. Matches Table
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
        add_column_if_not_exists(conn, "matches", "league_id", "INTEGER")

        # 3. Elo Table
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS elo_ratings (
                id SERIAL PRIMARY KEY,
                team_name VARCHAR(100) UNIQUE NOT NULL,
                elo_rating FLOAT NOT NULL
            )
        """))

        # 4. Players Table
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
        
        # Safe migrations for Players
        add_column_if_not_exists(conn, "players", "height",      "INTEGER")
        add_column_if_not_exists(conn, "players", "foot",        "VARCHAR(20)")
        add_column_if_not_exists(conn, "players", "position",    "VARCHAR(100)")
        add_column_if_not_exists(conn, "players", "nationality", "VARCHAR(100)")

        # 5. Utilities
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
            CREATE TABLE IF NOT EXISTS high_scores (
                id SERIAL PRIMARY KEY,
                game_type VARCHAR(30) NOT NULL,
                score INTEGER NOT NULL,
                created_at TIMESTAMP DEFAULT NOW()
            )
        """))

    print("Database schema verified and updated successfully.")

if __name__ == "__main__":
    init_db()
